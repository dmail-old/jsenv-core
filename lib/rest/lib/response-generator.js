// I would like to move all external logic into middlewares
// timeout, noBodyMethod, noBodyStatus all would belong to middleware and thus become optional
// think about checking es6-project/lib/start.js

// http://jakearchibald.com/2015/thats-so-fetch/
// we may need to clone the response stream (at least when it comes from cache)
// http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=fr

import env from 'env';
import proto from 'env/proto';
import Timeout from 'env/timeout';
import Thenable from 'env/thenable';
import Iterable from 'env/iterable';

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
    middlewares: [],

    timeoutValue: 1000,

    noBodyMethod: ['HEAD', 'CONNECT'],
    noBodyStatus: [101, 204, 205, 304],

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

    then(a, b) {
        return this.promise.then(a, b);
    },

    catch(a) {
        return this.promise.catch(a);
    },

    createRequestHandlerPromise(request) {
        var requestHandlerPromise = Thenable.callFunction(this.handleRequest, this, request);
        return requestHandlerPromise;
    },

    createResponseHandlerPromise(request, response) {
        var responseHandlerPromise = Thenable.callFunction(this.handleResponse, this, request, response);
        return responseHandlerPromise;
    },

    open() {
        if (this.state !== 'created') {
            return Promise.reject(new Error('open() error : state must be "created", not "' + this.state + '"'));
        }
        this.state = 'opening';
        this.request = this.requestModel.clone(this.uri, this.options);
        this.request.responseGenerator = this;
        this.requestHandlerPromise = this.createRequestHandlerPromise();

        var promises = [];

        // abort promise
        promises.push(this.abortPromise);
        // timeout promise
        promises.push(this.timeoutPromise);
        // response promise
        promises.push(this.requestHandlerPromise);

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
        }.bind(this)).then(
            function(response) {
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
            }.bind(this),
            function(value) {
                this.state = 'closed';
                return Promise.reject(value);
            }.bind(this)
        ).then(function(response) {
            response.uri = this.request.uri.clone();

            env.info(response.status, String(response.uri));

            return response;
        }.bind(this).then(function(response) {
            // now I do have a response for the request, I can implement some spefific behaviour like retry and redirect
            // timeout is a transverse feature, for we keep it here but I may belong to new object
            // I don't know how to call these objects
            // maybe restClientFeature, let's call it restPlugin for now
            // that could be a middleware after call but a specific one as it can change the response object and remains
            // concerned by the timeout
            // btw middleware where also concerned by the timeout
            // so there is no plugin it's middleware

            this.response = response;
            this.responseHandlerPromise = this.createResponseHandlerPromise(this.request, response);

            // explicitely prevent handleResponse() from returning a different response object
            // it can only modify the existing one (a middleware must do request.responseGenerator.response = response)
            // to modify the response
            return this.responseHandlerPromise.then(function() {
                return this.response;
            }.bind(this));
        }.bind(this)));
    },

    retry() {
        this.close();

        // if (this.state === 'closed') {
        //     throw new NetWorkError('a request can be retried only once his responseGenerator is closed');
        // }
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

function reduceIterableToAbortableThenable(iterable, initialValue, condition, bind) {
    // keep track of thenable being executed
    var currentThenable;
    var iterableThenables = Iterable.map(iterable, function(responseHandlerPromise) {
        currentThenable = responseHandlerPromise;
        return responseHandlerPromise;
    }, this);

    var promise = Iterable.reduceToThenable(iterableThenables, initialValue, condition, bind);

    promise.abort = function() {
        if (currentThenable && currentThenable.abort) {
            currentThenable.abort();
        }
    };

    return promise;
}

// handle request middleware section
(function() {
    function createMiddlewareMatchPromise(middleware, request) {
        return Thenable.callFunction(middleware.match, middleware, request).then(function(matched) {
            return matched ? middleware : null;
        });
    }

    function createMiddlewareMatchIterablePromise(middlewares, request) {
        return Iterable.map(middlewares, function(middleware) {
            return 'match' in middleware ? createMiddlewareMatchPromise(middleware, request) : Promise.resolve(false);
        });
    }

    function middlewareHasMatched(value) {
        return Boolean(value);
    }

    Object.assign(ResponseGenerator, {
        fallbackHeadWithGet: true, // head method fallback to get method

        prepare(request) {
            return Iterable.reduceToThenable(Iterable.map(this.middlewares, function(middleware) {
                return 'prepare' in middleware ? Thenable.callFunction(middleware.prepare, middleware, request) : null;
            }, this));
        },

        // return the middleware handling the request
        match(request) {
            var middlewareMatchIterablePromise = createMiddlewareMatchIterablePromise(this.middlewares, request);

            return reduceIterableToAbortableThenable(middlewareMatchIterablePromise, null, middlewareHasMatched);
        },

        handleRequest(request) {
            // prepare() -> prepare the request before sending it
            // match() + handle or methods{} -> generate a response
            // intercept() -> modify the created response

            return this.prepare(request).then(function() {
                return this.match(request);
            }).then(function(middleware) {
                // no middleware to handle the request
                if (!middleware) {
                    // not implemented
                    return 501;
                }

                var requestHandler;

                if ('handle' in middleware) {
                    requestHandler = middleware.handle;
                } else if ('methods' in middleware) {
                    var requestMethod = request.method.toLowerCase();
                    var methodName = requestMethod;
                    var availableMethods = middleware.methods;
                    var availableMethodNames = Object.keys(availableMethods);

                    // no method available on this middleware
                    if (availableMethodNames.length === 0) {
                        return 501;
                    }

                    if (this.fallbackHeadWithGet && requestMethod === 'head' &&
                        (requestMethod in availableMethods) === false) {
                        methodName = 'get';
                    }
                    if ((methodName in availableMethods) === false) {
                        methodName = '*';
                    }

                    if ((methodName in availableMethods) === false) {
                        // method not allowed
                        return {
                            status: 405,
                            headers: {
                                allow: availableMethodNames.map(function(name) {
                                    return name.toUppercase();
                                }).join(', ')
                            }
                        };
                    }

                    requestHandler = availableMethods[methodName];
                }

                return Thenable.callFunction(requestHandler, middleware, request);
            }.bind(this));
        }
    });
})();

// handleResponse middleware section
(function() {
    function createMiddlewareInterceptorPromise(middleware, request, response) {
        var interceptorPromise;
        var intercept = middleware.intercept;

        if (intercept) {
            interceptorPromise = Thenable.callFunction(intercept, middleware, request, response);
            interceptorPromise = Thenable.abortable(interceptorPromise);
        } else {
            interceptorPromise = Promise.resolve();
        }

        return interceptorPromise;
    }

    function createInterceptorIterablePromise(responseGenerator) {
        return Iterable.map(responseGenerator.middlewares, function(middleware) {
            return createMiddlewareInterceptorPromise(
                middleware,
                responseGenerator.request,
                responseGenerator.response
            );
        });
    }

    Object.assign(ResponseGenerator, {
        handleResponse() {
            var iterablePromise = createInterceptorIterablePromise(this);

            return reduceIterableToAbortableThenable(iterablePromise);
        }
    });
})();

export default ResponseGenerator;
