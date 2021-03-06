import Iterable from '@jsenv/iterable';
import Thenable from '@jsenv/thenable';

// import Request from './request.js';
import ResponseGenerator from './response-generator.js';

const MatchProperties = {
    // return the service handling the request
    match(request) {
        var serviceMatchIterablePromise = createServiceMatchIterablePromise(this.services, request);

        return reduceIterableToAbortableThenable(serviceMatchIterablePromise, null, serviceHasMatched);
    }
};
function createServiceMatchIterablePromise(services, request) {
    return Iterable.map(services, function(service) {
        return createServiceMatchPromise(service, request);
    });
}
function createServiceMatchPromise(service, request) {
    return Thenable.callFunction(service.match, service, request).then(function(matched) {
        return matched ? service : null;
    });
}
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
function serviceHasMatched(value) {
    return Boolean(value);
}

const RequestProperties = {
    fallbackHeadWithGet: true, // head method fallback to get method

    handleRequest(request) {
        return this.match(request).then(service => {
            // no service to handle the request
            if (!service) {
                // not implemented
                return 501;
            }

            var requestMethod = request.method.toLowerCase();
            var methodName = requestMethod;
            var availableMethods = service.methods;
            var availableMethodNames = Object.keys(availableMethods);

            // no method available on this service
            if (availableMethodNames.length === 0) {
                return 501;
            }

            if (this.fallbackHeadWithGet && requestMethod === 'head' && (requestMethod in availableMethods) === false) {
                methodName = 'get';
            }
            if (methodName in availableMethods === false) {
                methodName = '*';
            }

            if (methodName in availableMethods === false) {
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

            return Thenable.callFunction(availableMethods[methodName], service, request);
        });
    }
};

const ResponseProperties = {
    handleResponse(request, response) {
        var iterablePromise = createInterceptorIterablePromise(this.services, request, response);

        return reduceIterableToAbortableThenable(iterablePromise);
    }
};
function createInterceptorIterablePromise(services, request, response) {
    return Iterable.map(services, function(service) {
        return createServiceInterceptorPromise(service, request, response);
    });
}
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

var ServiceResponseGenerator = ResponseGenerator.compose(
    {
        services: []
    },
    MatchProperties,
    RequestProperties,
    ResponseProperties
);

export default ServiceResponseGenerator;
