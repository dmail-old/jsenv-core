import env from 'env';

import Request from '../../request.js';

import Middleware from '../middleware.js';

import Cache from './cache.js';

Request.defaultOptions.cacheMode = 'default'; // 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'

const CacheMiddleware = Middleware.extend('CacheMiddleware', {
    constructor(options) {
        CacheMiddleware.super.constructor.call(this, options);
        this.cache = Cache.create(options);
    },

    methods: {
        '*': function(request) {
            var cache = this.cache;
            var cacheMode = request.cacheMode;

            // avoid browser cache by adding a param
            if (cacheMode === 'no-cache' || cacheMode === 'no-store') {
                if (env.isBrowser()) {
                    // if (!env.support('fetch')) // if we use xhr we have to prevent cache
                    // prevent browser from caching
                    request.uri.searchParams.set('r', String(Math.random() + 1).slice(2));
                }
            } else if (cacheMode === 'default') {
                var cachedResponse = cache.get(request);

                // test if the cached response has expired
                if (cachedResponse) {
                    if (cachedResponse.headers.has('expires') && cachedResponse.headers.has('date')) {
                        var ellapsedTime = new Date() - new Date(cachedResponse.headers.get('date'));

                        if (ellapsedTime > cachedResponse.headers.get('expires')) {
                            cache.delete(request);
                            cachedResponse = null;
                        }
                    }
                }

                if (cachedResponse) {
                    if (cachedResponse.headers.has('last-modified')) {
                        // il y a des choses à faire avant de valider la réponse
                        request.headers.set('if-modified-since', cachedResponse.headers.get('last-modified'));
                    } else if (cachedResponse.cacheState === 'validated' || cachedResponse.cacheState === 'local') {
                        // resolve immediatly
                        return cachedResponse.clone();
                    }
                }
            }
        }
    },

    intercept(request, response) {
        var cache = this.cache;
        var status = response.status;

        if (cache) {
            if (status === 304) {
                var cachedResponse = cache.get(request);

                if (cachedResponse === null) {
                    throw new Error('no cache for 304 response');
                } else {
                    response = cachedResponse.clone();
                    response.status = 200;
                    response.cacheState = 'validated';
                }
            }
            var cacheMode = request.cacheMode;
            if (cacheMode === 'default' || cacheMode === 'force-cache' || cacheMode === 'reload') {
                cache.set(request, response);
            }
        }
    }
});

export default CacheMiddleware;

export const test = {
    modules: ['@node/assert', '../../response.js'],

    main(assert, Response) {
        this.add("maxLength", function() {
            var cache = Cache.create();
            cache.maxLength = 1;

            var reqA = Request.create();
            var reqB = Request.create({method: 'post'}); // must be a diff request, else it's considered as cached
            var resA = Response.create();
            var resB = Response.create();

            cache.set(reqA, resA);
            assert.equal(cache.has(reqA), true);
            assert.equal(cache.length, 1);
            cache.set(reqB, resB);
            assert.equal(cache.has(reqA), false);
        });

        this.add("byteLimit", function() {
            var cache = Cache.create();
            cache.byteLimit = 10;

            var requestA = Request.create();
            var responseA = Response.create({
                body: '',
                headers: {
                    'content-length': 5
                }
            });
            var responseB = Response.create({
                body: '',
                headers: {
                    'content-length': 15
                }
            });

            cache.set(requestA, responseA);
            assert.equal(cache.byteLength, 5);

            assert.throws(function() {
                cache.set(requestA, responseB);
            }, function(e) {
                return e.name === 'RangeError';
            });
        });

        this.add("vary headers", function() {

        });
    }
};
