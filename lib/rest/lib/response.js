// https://developer.mozilla.org/en-US/docs/Web/API/Response

import proto from 'env/proto';

import Headers from './headers.js';
import BodyConsumer from './body-consumer.js';
import Body from './body.js';

var Response = proto.extend('Response', BodyConsumer, {
    status: undefined,
    headers: null,
    body: null,
    redirectCount: 0,
    uri: null,

    cacheState: 'none', // 'local', 'validated', 'partial'

    constructor(options) {
        options = options || {};

        Object.assign(this, options);

        this.headers = Headers.create(this.headers);
        if (this.hasOwnProperty('body')) {
            this.body = Body.create(this.body);
        }
    },

    get url() {
        return this.uri.toURL();
    },

    clone() {
        var properties = {};

        Object.getOwnPropertyNames(this).forEach(function(name) {
            properties[name] = this[name];
        }, this);

        if (properties.body) {
            var out = this.body.tee();
            this.body = out[0];
            properties.body = out[1];
        }

        var cloneResponse = this.create(properties);

        return cloneResponse;
    }
});

export default Response;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('headers options', function() {
            var response = Response.create({
                headers: {
                    'content-length': 10
                }
            });

            assert.equal(response.headers.get('content-length'), 10);
        });

        this.add('headers clone', function() {
            var response = Response.create({
                headers: {
                    'content-length': 10
                }
            });

            var clonedResponse = response.clone();

            assert.equal(clonedResponse.headers.has('content-length'), true);
            assert.equal(clonedResponse.headers.get('content-length'), 10);
        });
    }
};
