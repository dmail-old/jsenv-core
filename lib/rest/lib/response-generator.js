// I would like to move all external logic into middlewares
// timeout, noBodyMethod, noBodyStatus all would belong to middleware and thus become optional

// http://jakearchibald.com/2015/thats-so-fetch/
// we may need to clone the response stream (at least when it comes from cache)
// http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=fr

import env from 'env';
import proto from 'env/proto';
import Timeout from 'env/timeout';
import Thenable from 'env/thenable';

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

export {NetWorkError};

var ResponseGenerator = proto.extend('ResponseGenerator', {
    timeoutValue: 1000,

    noBodyMethod: ['HEAD', 'CONNECT'],
    noBodyStatus: [101, 204, 205, 304],
    currentURL: null,

    state: '', // created, opening, opened, closed

    handleRequest() {}, // function trying to produce a response
    handleResponse() {}, // function acting on response produced

    constructor(request, options) {
        this.requestModel = request;
        this.uri = request.uri;
        this.options = options;
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

    redirect(uri) {
        this.uri = uri;
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

    open() {
        if (this.state !== 'created') {
            return Promise.reject(new Error('open() error : state must be "created", not "' + this.state + '"'));
        }
        this.state = 'opening';
        this.request = this.requestModel.clone(this.uri, this.options);
        this.request.responseGenerator = this;

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
            response.uri = this.request.uri.clone();

            env.info(response.status, String(response.uri));

            return response;
        }.bind(this).then(function(response) {
            return this.createResponseHandlerPromise(this.request, response);
        }.bind(this)));
    },

    retry() {
        if (this.state !== 'closed') {
            throw new NetWorkError('a request can be retried only once his responseGenerator is closed');
        }
        // because statis is closed we dont need to call abort()
        // there is nothing to abort anymore

        this.state = 'created'; // put back to created
        return this.open();
    },

    retryAfter(ms) {
        // after a short delay we retry the request
        return Thenable.callFunctionAfter(function() {
            return this.retry();
        }.bind(this), ms);
    },

    retryOn(uri) {
        this.redirect(uri);
        return this.retry();
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
