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

import env from 'env';
import proto from 'env/proto';
import Timeout from 'env/timeout';
import Thenable from 'env/thenable';

import Request from './request.js';
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

Request.defaultOptions.redirectMode = 'follow'; // 'error', 'manual'

var ResponseGenerator = proto.extend('ResponseGenerator', {
    redirectLimit: 20,
    lastRetry: 0,
    timeoutValue: 1000,

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
        this.timeout.then(this.expire.bind(this));

        this.abortPromise = new Promise(function(resolve, reject) {
            this.rejectAbort = reject;
        }.bind(this));
        this.timeoutPromise = new Promise(function(resolve, reject) {
            this.rejectTimeout = reject;
        }.bind(this));

        this.promise = this.open();
    },

    get url() {
        return this.uri.toURL();
    },

    then(a, b) {
        return this.promise.then(a, b);
    },

    catch(a) {
        return this.promise.catch(a);
    },

    createRequestHandlerPromise(request) {
        this.requestHandlerPromise = Thenable.callFunction(this.handleRequest, this, request);
        return this.requestHandlerPromise;
    },

    createResponseHandlerPromise(request, response) {
        this.responseHandlerPromise = Thenable.callFunction(this.handleResponse, this, request, response);

        // explicitely prevent handleResponse() from returning a different esponse object
        // it can only modify the existing one
        return this.responseHandlerPromise.then(function() {
            return response;
        });
    },

    createResponsePropertiesPromise() {
        return this.createRequestHandlerPromise(this.request).then(function(response) {
            if (response !== undefined) {
                return response;
            }
        });
    },

    retry(delay) {
        if (typeof delay === 'string') {
            if (isNaN(delay)) {
                try {
                    delay = new Date(delay);
                } catch (e) {
                    throw e;
                }
            } else {
                delay = delay % 1 === 0 ? parseInt(delay) : parseFloat(delay);
                delay *= 1000; // delay headers is in seconds but we need ms
            }
        }
        if (delay instanceof Date) {
            delay -= new Date();
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

    redirect(uri/* , temporary */) {
        if (this.request.redirectMode === 'error') {
            throw new NetWorkError('redirection not supported by redirectMode');
        }

        if (this.request.redirectMode === 'follow') {
            // max redirect limit reached
            if (this.redirectCount >= this.redirectLimit) {
                throw new NetWorkError('redirect limit reached');
            }

            this.redirectCount++;
            this.request.uri = env.createURI(uri); // we are loosing the original uri for this request, for now let's keep it that way

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
        // console.log('resolved normally');
        return response;
    },

    prepareResponse(response) {
        response.redirectCount = this.redirectCount;
        response.uri = this.request.uri.clone();

        env.info(response.status, String(response.uri));

        return response;
    },

    open() {
        if (this.state !== 'created') {
            return Promise.reject(new Error('open() error : state must be "created", not "' + this.state + '"'));
        }
        this.state = 'opening';

        var promises = [];

        // abort promise
        promises.push(this.abortPromise);
        // timeout promise
        promises.push(this.timeoutPromise);
        // response promise
        promises.push(this.responsePropertiesPromise = this.createResponsePropertiesPromise());

        return Promise.race(promises).then(function(responseProperties) {
            if (this.state !== 'opening') {
                throw new Error('opened() error : state must be "opening", not "' + this.state + '"');
            }
            this.state = 'opened';

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
                throw new TypeError('responseProperties must be an object');
            }

            return response;
        }.bind(this)).then(function(response) {
            if (this.noBodyMethod.includes(this.request.method) || this.noBodyStatus.includes(response.status)) {
                if (response.body) {
                    response.body.cancel();
                    response.body = null;
                }
            }

            if (response.body) {
                response.body.then(this.close.bind(this));
            } else {
                this.close();
            }

            return response;
        }.bind(this), function(value) {
            this.state = 'closed';
            return Promise.reject(value);
        }.bind(this)).then(function(response) {
            return this.createResponseHandlerPromise(this.request, response);
        }.bind(this)).then(function(response) {
            var result = this.checkRedirectionAndRetry(response);

            // if the result is a response prepare it
            if (Response.isPrototypeOf(result)) {
                return this.prepareResponse(result);
            }
            return result;
        }.bind(this));
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
        }
    }
});

export default ResponseGenerator;
