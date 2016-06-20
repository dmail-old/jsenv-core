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

var ServiceResponseGenerator = ResponseGenerator.extend({
    services: []
});

function createServiceMatchPromise(service, request) {
    return Thenable.callFunction(service.match, service, request).then(function(matched) {
        return matched ? service : null;
    });
}

function createServiceMatchIterablePromise(services, request) {
    return Iterable.map(services, function(service) {
        return 'match' in service ? createServiceMatchPromise(service, request) : Promise.resolve(false);
    });
}

function serviceHasMatched(value) {
    return Boolean(value);
}

Object.assign(ServiceResponseGenerator, {
    fallbackHeadWithGet: true, // head method fallback to get method

    prepare(request) {
        return Iterable.reduceToThenable(Iterable.map(this.services, function(service) {
            return 'prepare' in service ? Thenable.callFunction(service.prepare, service, request) : null;
        }, this));
    },

    // return the service handling the request
    match(request) {
        var serviceMatchIterablePromise = createServiceMatchIterablePromise(this.services, request);

        return reduceIterableToAbortableThenable(serviceMatchIterablePromise, null, serviceHasMatched);
    },

    handleRequest(request) {
        // prepare() -> prepare the request before sending it
        // match() + handle or methods{} -> generate a response
        // intercept() -> modify the created response

        return this.prepare(request).then(function() {
            return this.match(request);
        }).then(function(service) {
            // no service to handle the request
            if (!service) {
                // not implemented
                return 501;
            }

            var requestHandler;

            if ('handle' in service) {
                requestHandler = service.handle;
            } else if ('methods' in service) {
                var requestMethod = request.method.toLowerCase();
                var methodName = requestMethod;
                var availableMethods = service.methods;
                var availableMethodNames = Object.keys(availableMethods);

                // no method available on this service
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

            return Thenable.callFunction(requestHandler, service, request);
        }.bind(this));
    }
});

function createServiceInterceptorPromise(service, request, response) {
    var interceptorPromise;
    var intercept = service.intercept;

    if (intercept) {
        interceptorPromise = Thenable.callFunction(intercept, service, request, response);
        interceptorPromise = Thenable.abortable(interceptorPromise);
    } else {
        interceptorPromise = Promise.resolve();
    }

    return interceptorPromise;
}

function createInterceptorIterablePromise(services, request, response) {
    return Iterable.map(services, function(service) {
        return createServiceInterceptorPromise(service, request, response);
    });
}

Object.assign(ServiceResponseGenerator, {
    handleResponse(request, response) {
        var iterablePromise = createInterceptorIterablePromise(this.services, request, response);

        return reduceIterableToAbortableThenable(iterablePromise);
    }
});

export default ServiceResponseGenerator;
