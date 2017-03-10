// http://jakearchibald.com/2015/thats-so-fetch/
// we may need to clone the response stream (at least when it comes from cache)
// http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=fr

// note : http://stackoverflow.com/questions/15155014/inconsistent-browser-retry-behaviour-for-timed-out-post-requests
// http://www.w3.org/Protocols/rfc2616/rfc2616-sec8.html#sec8.2.4
// in short: when request is closed before any response is received, retry it (but browser will do it auto)
// so only node should implement this behaviour

/*
some redirection are permanent, in such case we should auto redirect request on the same url
*/

import env from '@jsenv/env';
import Timeout from '@jsenv/timeout';
import Thenable from '@jsenv/thenable';
import compose from '@jsenv/compose';

// import Request from './request.js';
import Response from './response.js';

function createTimeoutError(ms) {
    var error = new Error('still waiting to get a response after ' + ms);
    error.name = 'NetWorkError';
    error.code = 'REQUEST_TIMEOUT';
    return error;
}
function NetWorkError(message) {
    var error = new Error(message || 'not specified');
    error.name = 'NetWorkError';
    return error;
}

const ResponseGenerator = compose('ResponseGenerator', {
    redirectLimit: 20,
    lastRetry: 0,
    timeoutValue: 1000 * 60,

    noBodyMethod: ['HEAD', 'CONNECT'],
    noBodyStatus: [101, 204, 205, 304],
    redirectStatus: [301, 302, 307],
    retryStatus: [301, 302, 307, 503],
    redirectCount: 0,
    currentURL: null,

    state: '', // created, opening, opened, closed

    handleRequest() {}, // function trying to produce a response
    handleResponse() {}, // function acting on response produced

    constructor(request) {
        this.request = request;
        this.state = 'created';
        this.timeout = Timeout.create(this.timeoutValue);
        this.timeout.promise.then(this.expire.bind(this));

        this.abortPromise = new Promise((resolve, reject) => {
            this.rejectAbort = reject;
        });
        this.timeoutPromise = new Promise((resolve, reject) => {
            this.rejectTimeout = reject;
        });

        this.promise = this.open();
    },

    then(a, b) {
        return this.promise.then(a, b);
    },

    catch(a) {
        return this.promise.catch(a);
    },

    retry(delay) {
        if (typeof delay === 'string') {
            if (isNaN(delay)) {
                try {
                    delay = Number(new Date(delay));
                } catch (e) {
                    throw e;
                }
            } else {
                delay = delay % 1 === 0 ? parseInt(delay) : parseFloat(delay);
                delay *= 1000; // delay headers is in seconds but we need ms
            }
        }
        if (delay instanceof Date) {
            delay -= Number(new Date());
        }
        if (typeof delay !== 'number') {
            throw new TypeError('delay expects a date or a number');
        }
        if (delay < 0) {
            throw new RangeError('delay must be a future date or a positive number');
        }

        this.lastRetry = delay;

        return delay;
    },

    redirect(url/* , temporary */) {
        if (this.request.redirectMode === 'error') {
            throw new NetWorkError('redirection not supported by redirectMode');
        }

        if (this.request.redirectMode === 'follow') {
            // max redirect limit reached
            if (this.redirectCount >= this.redirectLimit) {
                throw new NetWorkError('redirect limit reached');
            }

            this.redirectCount++;
            this.request = this.request.clone(); // make almost the same request at different url
            this.request.url = env.createUrl(url);
            // this.request.url = new global.URL(url);

            return true;
        }

        return false;
    },

    checkRedirectionAndRetry(response) {
        // retry & redirect
        var retryDelay;
        var isRedirected;

        // redirection
        if (response.headers.has('location') && this.redirectStatus.includes(response.status)) {
            isRedirected = this.redirect(response.headers.get('location'), response.status === 307);
        }
        // retry
        if (response.headers.has('retry-after') && this.retryStatus.includes(response.status)) {
            retryDelay = this.retry(response.headers.get('retry-after'));
        }

        if (typeof retryDelay === 'number' || isRedirected) {
            if (response.body) {
                response.body.cancel(); // don't consume the response body
            }
            // we don't need to call abort() because once we're here there is nothing to abort anymore
            this.state = 'created'; // put state back to 'created'

            if (isRedirected) {
                // console.log('redirected to', this.request.url);
                return this.open();  // reopen a new request at the redirected request
            }
            // console.log('retrying in', retryDelay);
            this.retryPromise = Thenable.callFunctionAfter(this.open.bind(this), retryDelay);
            return this.retryPromise;
        }
        return response;
    },

    prepareResponse(response) {
        response.redirectCount = this.redirectCount;
        response.url = this.request.url.clone();

        env.info(response.status, String(response.url));

        return response;
    },

    open() {
        var generator = this;

        if (generator.state !== 'created') {
            return Promise.reject(new Error('open() error : state must be "created", not "' + this.state + '"'));
        }
        generator.state = 'opening';

        function createRequestHandlerPromise(request) {
            generator.requestHandlerPromise = Thenable.callFunction(generator.handleRequest, generator, request);
            return generator.requestHandlerPromise;
        }
        function createResponsePropertiesPromise() {
            return createRequestHandlerPromise(generator.request).then(response => {
                if (response !== undefined) {
                    return response;
                }
            });
        }
        function createResponsePromise() {
            var promises = [];

            // abort promise
            promises.push(generator.abortPromise);
            // timeout promise
            promises.push(generator.timeoutPromise);
            // response promise
            promises.push(generator.responsePropertiesPromise = createResponsePropertiesPromise());

            return Promise.race(promises).then(responseProperties => {
                if (generator.state !== 'opening') {
                    throw new Error('opened() error : state must be "opening", not "' + generator.state + '"');
                }
                generator.state = 'opened';

                // if the promise resolved without providing response
                // it returns a 501 not implemented response
                if (responseProperties === null || responseProperties === undefined) {
                    responseProperties = 501;
                }
                if (typeof responseProperties === 'number') {
                    responseProperties = {status: responseProperties};
                }

                var response;
                if (typeof responseProperties === 'object') {
                    if (Response.isPrototypeOf(responseProperties)) {
                        response = responseProperties;
                    } else if (responseProperties.constructor === Object) {
                        response = Response.create(responseProperties);
                    } else {
                        throw new TypeError('responseProperties must be a plain object');
                    }
                } else {
                    throw new TypeError(`responseProperties must be an object (got ${responseProperties})`);
                }

                return response;
            });
        }
        function createResponseHandlerPromise(response) {
            generator.responseHandlerPromise = Thenable.callFunction(
                generator.handleResponse,
                generator,
                generator.request,
                response
            );

            // explicitely prevent handleResponse() from returning a different response object
            // it can only modify the existing one
            return generator.responseHandlerPromise.then(() => {
                return response;
            });
        }

        return createResponsePromise().then(
            response => {
                if (
                    generator.noBodyMethod.includes(generator.request.method) ||
                    generator.noBodyStatus.includes(response.status)
                ) {
                    if (response.body) {
                        response.body.cancel();
                        response.body = null;
                    }
                }

                if (response.body) {
                    response.body.then(generator.close.bind(generator));
                } else {
                    generator.close();
                }

                return response;
            },
            rejectedValue => {
                generator.state = 'closed';
                generator.clean();
                console.error('internal error', rejectedValue instanceof Error ? rejectedValue.stack : rejectedValue);
                const response = Response.create({
                    status: 500,
                    body: rejectedValue instanceof Error ? rejectedValue.stack : rejectedValue
                });
                return response;
            }
        ).then(
            createResponseHandlerPromise
        ).then(response => {
            var result = generator.checkRedirectionAndRetry(response);

            // if the result is a response prepare it
            if (Response.isPrototypeOf(result)) {
                return generator.prepareResponse(result);
            }
            return result;
        });
    },

    callAbort(name) {
        var promise = this[name];

        if (promise) {
            if (promise.abort) {
                promise.abort();
                this[name] = null;
                return true;
            }
            return false;
        }
        return false;
    },

    /**
    * clean any current operation preventing response from being generated expecting this object
    * to be garbage collected and not used by anything else anymore
    * called by :
    * - explicit abort() call
    * - explicit expire() call or implicit expire() when timeout is reached
    * - explicit close() while state is created or opening
    **/
    clean() {
        this.timeout.clear();
        if (this.state === 'opening') {
            // abort any services trying to generate a response for the request
            this.callAbort('requestHandlerPromise');
        } else if (this.state === 'opened') {
            // abort middlewares trying to change the response
            this.callAbort('responseHandlerPromise');
        } else if (this.state === 'created') {
            // abort promise wanting to retry to generate a response
            this.callAbort('retryPromise');
        }
    },

    abort() {
        this.clean();
        this.rejectAbort();
    },

    expire() {
        this.clean();
        this.rejectTimeout(createTimeoutError(this.timeout.value));
    },

    close() {
        if (this.state === 'created' || this.state === 'opening') {
            this.abort(); // close while running means abort()
        } else if (this.state === 'opened') {
            this.state = 'closed';
            this.clean();
        }
    }
});

export default ResponseGenerator;
