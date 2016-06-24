import env from 'env';
import proto from 'env/proto';

import Headers from './headers.js';
import Body from './body.js';
import Response from './response.js';
import Request from './request.js';
import Middleware from './middleware/middleware.js';
import ResponseGeneratorWithMiddlewares from './middleware/response-generator-middleware.js';

// import polymorph from './util/polymorph.js';

var rest = proto.extend('Rest', {
    uri: env.baseURI,
    methods: ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'],

    constructor() {
        this.ResponseGenerator = ResponseGeneratorWithMiddlewares.extend({middlewares: []});
        this.middlewares = this.ResponseGenerator.middlewares;
    },

    createURI(data) {
        if (arguments.length === 0) {
            return this.uri.clone();
        }
        return this.uri.resolve(data);
    },

    createHeaders(options) {
        return Headers.create(options);
    },

    createBody(data) {
        return Body.create(data);
    },

    createResponse(options) {
        return Response.create(options);
    },

    createRequest(uri, options) {
        return Request.create(uri, options);
    },

    // service properties
    createMiddleware(options) {
        return Middleware.extend(options);
    },

    use(middleware) {
        this.middlewares.push(middleware);
        // note : take into account service.priority and sort them
        return middleware;
    },

    findServiceByName(name) {
        return this.services.find(function(service) {
            return service.name === name;
        });
    },

    findMiddlewareMatch(request) {
        return this.ResponseGenerator.match(request);
    },

    removeMiddleware(service) {
        this.middlewares.splice(this.middlewares.indexOf(service), 0, 1);
        return this;
    },

    // generating response
    createResponsePromiseForRequest(request) {
        var responseGenerator = this.ResponseGenerator.create(request);
        return responseGenerator;
    },

    fetch(uriOrRequest, options) {
        var request;
        var responsePromise;

        if (Request.isPrototypeOf(uriOrRequest)) {
            request = uriOrRequest.clone(options);
            responsePromise = this.createResponsePromiseForRequest(request);
        } else {
            var uri = uriOrRequest;

            try {
                request = this.createRequest(uri, options);
                responsePromise = this.createResponsePromiseForRequest(request);
            } catch (e) {
                responsePromise = Promise.reject(e);
            }
        }

        return responsePromise;
    }
});

rest.constructor();

// method helpers
(function() {
    function fetchCustom(rest, uriOrRequest, options, forceOptions) {
        var requestOptions;
        if (options) {
            requestOptions = options;
        } else {
            requestOptions = {};
        }

        if (forceOptions) {
            Object.assign(requestOptions, forceOptions);
        }

        return rest.fetch(uriOrRequest, requestOptions);
    }

    rest.methods.forEach(function(methodName) {
        rest[methodName] = function(uriOrRequest, options = {}) {
            return fetchCustom(this, uriOrRequest, options, {
                method: methodName.toUpperCase()
            });
        };
    });
})();

/*
use: polymorph(
    [Function],
    function(requestHandler){
        var service = this.createService({
            name: requestHandler.name,
            requestHandler: requestHandler
        });
        return this.use(service);
    },

    [,Function],
    function(requestHandler, responseHandler){
        var service = this.createService({
            name: responseHandler.name,
            responseHandler: responseHandler
        });
        return this.use(service);
    },

    [Function, Function],
    function(requestHandler, responseHandler){
        var service = this.createService({
            name: requestHandler.name,
            requestHandler: requestHandler,
            responseHandler: responseHandler
        });

        return this.use(service);
    },

    [Service],
    function(service){
        return this.addService(service);
    }
)
*/

export default rest;
