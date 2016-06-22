import Iterable from 'env/iterable';
import Thenable from 'env/thenable';

// import Request from './request.js';
import ResponseGenerator from './response-generator.js';

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

var MiddlewareResponseGenerator = ResponseGenerator.extend({
    middlewares: []
});

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

Object.assign(MiddlewareResponseGenerator, {
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

function createInterceptorIterablePromise(middlewares, request, response) {
    return Iterable.map(middlewares, function(middleware) {
        return createMiddlewareInterceptorPromise(middleware, request, response);
    });
}

Object.assign(MiddlewareResponseGenerator, {
    handleResponse(request, response) {
        var iterablePromise = createInterceptorIterablePromise(this.middlewares, request, response);

        return reduceIterableToAbortableThenable(iterablePromise);
    }
});

export default MiddlewareResponseGenerator;
