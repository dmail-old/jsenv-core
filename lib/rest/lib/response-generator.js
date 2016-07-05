// I would like to move all external logic into middlewares
// timeout, noBodyMethod, noBodyStatus all would belong to middleware and thus become optional
// think about checking es6-project/lib/start.js

// http://jakearchibald.com/2015/thats-so-fetch/
// we may need to clone the response stream (at least when it comes from cache)
// http://www.html5rocks.com/en/tutorials/service-worker/introduction/?redirect_from_locale=fr

import env from 'env';
import proto from 'env/proto';
import Thenable from 'env/thenable';
import Iterable from 'env/iterable';

import Request from './request.js';
import Response from './response.js';

function NetWorkError(message) {
    var error = new Error(message || 'not specified');
    error.name = 'NetWorkError';
    return error;
}

export {NetWorkError};

const ResponseGenerator = proto.extend('ResponseGenerator', {
    middlewares: [],
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

    createResponsePropertiesPromise() {
        // externalResponsePromise allow to do responseGenerator.resolve('hello world')
        // from external code
        // while internalResponsePromise is used by middleware to produce a response
        // the first one to resolve is used to produce the response

        var externalResponsePromise = new Promise(function(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
        }.bind(this));

        this.request = this.requestModel.clone(this.uri, this.options);
        this.request.responseGenerator = this;
        this.request.cloneOf = this.requestModel;
        this.requestHandlerPromise = this.createRequestHandlerPromise(this.request);
        var internalResponsePromise = this.requestHandlerPromise;

        var promises = [];
        // abort promise
        promises.push(externalResponsePromise);
        // response promise
        promises.push(internalResponsePromise);
        var externalOrInternalResponsePromise = Promise.race(promises);

        return externalOrInternalResponsePromise;
    },

    createResponsePromise() {
        return this.createResponsePropertiesPromise().then(function(responseProperties) {
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
                    response = responseProperties; // we should clone it I think
                } else if (responseProperties.constructor === Object) {
                    response = Response.create(this.request.uri, responseProperties);
                } else {
                    throw new TypeError('responseProperties must be a plain object');
                }
            } else {
                throw new TypeError('responseProperties must be an object');
            }

            return response;
        }.bind(this));
    },

    open() {
        if (this.state !== 'created') {
            return Promise.reject(new Error('open() error : state must be "created", not "' + this.state + '"'));
        }
        this.state = 'opening';

        return this.createResponsePromise().then(
            function(response) {
                // save the response
                this.response = response;
                response.request = this.request;
                // response.uri = this.request.uri.clone();
                env.info(response.status, String(response.uri));

                if (this.noBodyMethod.includes(this.request.method) || this.noBodyStatus.includes(response.status)) {
                    this.close(); // do not read the response body
                } else if (response.body) {
                    response.body.then(function() {
                        // close on response body consumption
                        this.close(true);
                    }.bind(this));
                } else {
                    // close right now, nothing more expected from the response
                    this.close();
                }

                return response;
            }.bind(this),
            function(value) {
                this.state = 'closed';
                return Promise.reject(value);
            }.bind(this)
        ).then(function(response) {
            this.responseHandlerPromise = this.createResponseHandlerPromise(this.request, response);

            // explicitely prevent handleResponse() from returning a different response object
            // it can only modify the existing one (a middleware must do request.responseGenerator.response = response)
            // to modify the response
            return this.responseHandlerPromise.then(function() {
                return this.response;
            }.bind(this));
        }.bind(this));
    },

    retry(uri) {
        // you can retry a request when the current one is over OR while the current is being handled ONLY
        if (this.state === 'created' || this.state === 'opening') {
            throw new Error('retry must not be called while responseGenerator is created or opening');
        }
        this.close(); // close this generator he is not supposed to do more with the current response

        var responseGenerator = ResponseGenerator.create(this.requestModel, this.options);
        if (uri) {
            responseGenerator.uri = this.uri;
        }
        return responseGenerator.open().then(function(response) {
            this.response = response;
            return response;
        }.bind(this));
    },

    retryAfter(ms) {
        // after a short delay we retry the request
        return Thenable.callFunctionAfter(function() {
            return this.retry();
        }.bind(this), ms);
    },

    retryOn(uri) {
        return this.retry(uri);
    },

    redirect(uri) {
        return this.retryOn(uri);
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

    clean() {
        if (this.state === 'opening') {
            // abort any services trying to generate a response for the request
            this.callAbort('requestHandlerPromise');
        } else {
            // abort middlewares trying to change the response
            this.callAbort('responseHandlerPromise');
        }
    },

    abort() {
        this.clean();
        this.reject('aborted');
    },

    close(preserveBody) {
        if (this.state === 'created' || this.state === 'opening') {
            this.abort(); // close while running means abort()
        } else if (this.state === 'opened') {
            if (!preserveBody && this.response.body) {
                this.response.body.cancel();
            }
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

            this.middlewares = this.middlewares.map(function(middleware) {
                if ('requestConstructor' in middleware) {
                    var requestMiddleware = middleware.extend({request: this.request});
                    requestMiddleware.requestConstructor(this.request);
                    middleware = requestMiddleware;
                }
                return middleware;
            }, this);

            return this.prepare(request).then(function() {
                return this.match(request);
            }.bind(this)).then(function(middleware) {
                // no middleware to handle the request
                if (!middleware) {
                    // not implemented
                    return 501;
                }

                request.matchedMiddleware = middleware;

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
                                    return name.toUpperCase();
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

export const test = {
    modules: ['@node/assert', './middleware/middleware.js'],

    main(assert, Middleware) {
        function responseStatusIs(request, expectedStatus) {
            return ResponseGenerator.create(request).open().then(function(response) {
                assert.equal(response.status, expectedStatus);
            });
        }

        this.add('501 not implemented', function() {
            return responseStatusIs(Request.create(''), 501);
        });

        this.add('405 method not allowed', function() {
            var mid = Middleware.create({
                match() {
                    return true;
                },
                methods: {
                    post() {},
                    put() {}
                }
            });
            var gen = ResponseGenerator.extend({middlewares: [mid]});

            return gen.create(Request.create('')).open().then(function(response) {
                assert.equal(response.status, 405);
                assert.equal(response.headers.get('allow'), 'POST, PUT');
            });
        });

        function spy(method) {
            var theSpy = function() {
                theSpy.called = true;
                theSpy.calledOn = this;
                theSpy.calledWith = arguments;
                if (method) {
                    return method.apply(this, arguments);
                }
            };
            theSpy.called = false;

            return theSpy;
        }

        function assertCalledWithRequestInstanceAsFirstArgument(spy, request) {
            assert.equal(spy.calledWith[0].cloneOf, request);
        }

        this.add('middleware hooks', function() {
            var firstMid = Middleware.create({
                prepare: spy(function(request) {
                    return Promise.resolve().then(function() {
                        request.headers.set('foo', 'bar');
                    });
                }),

                match: spy(function() {
                    return true;
                }),

                methods: {
                    get: spy(function() {
                        return {
                            status: 200,
                            body: 'Hello world',
                            headers: {
                                'content-length': 11
                            }
                        };
                    })
                },

                intercept: spy()
            });
            var secondMid = Middleware.create({
                requestConstructor: spy(),
                prepare: spy(),
                match: spy(),
                methods: {
                    get: spy()
                },
                intercept: spy()
            });
            var gen = ResponseGenerator.extend({middlewares: [firstMid, secondMid]});
            var request = Request.create('');

            return gen.create(request).open().then(function(response) {
                assert.equal(secondMid.isPrototypeOf(secondMid.requestConstructor.calledOn), true); // called on middleware instance
                assertCalledWithRequestInstanceAsFirstArgument(secondMid.requestConstructor, request);

                // prepare
                assert.equal(firstMid.prepare.calledOn, firstMid);
                assert.equal(firstMid.prepare.calledWith.length, 1);

                assert.equal(firstMid.prepare.calledWith[0].headers.get('foo'), 'bar'); // request header was modified
                assert.equal(request.headers.has('foo'), false); // but original request headers are untouched
                assertCalledWithRequestInstanceAsFirstArgument(firstMid.prepare, request); // request arg is an instanceof the original request
                assert.equal(secondMid.prepare.called, true); // all prepare hook are called

                // match
                assert.equal(firstMid.match.calledOn, firstMid);
                assert.deepEqual(firstMid.match.calledWith, firstMid.prepare.calledWith);
                assert.equal(secondMid.match.called, false); // only one middleware can match

                // get method
                assert.equal(firstMid.methods.get.calledOn, firstMid);
                assert.deepEqual(firstMid.methods.get.calledWith, firstMid.prepare.calledWith);
                assert.equal(secondMid.methods.get.called, false); // only one middleware can generate a response

                // intercept
                assert.equal(firstMid.intercept.calledOn, firstMid);
                assert.equal(firstMid.intercept.calledWith.length, 2);
                assertCalledWithRequestInstanceAsFirstArgument(firstMid.intercept, request);
                assert.equal(firstMid.intercept.calledWith[1], response);
                assert.equal(secondMid.intercept.called, true); // all intercept hook are called

                // response
                assert.equal(response.status, 200);
                assert.equal(response.headers.get('content-length'), 11);
                assert.equal(response.request, firstMid.prepare.calledWith[0]);

                assert.equal(response.request.matchedMiddleware, firstMid);

                // response body
                return response.text().then(function(body) {
                    assert.equal(body, 'Hello world');
                });
            });
        });
    }
};
