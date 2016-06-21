import env from 'env';
import proto from 'env/proto';

import Headers from './headers.js';
import Body from './body.js';
import Response from './response.js';
import Request from './request.js';
import Service from './service.js';
import ResponseGeneratorWithServices from './response-generator-service.js';

// import polymorph from './util/polymorph.js';

// all that would belong directly to the request object because it's always a request which is fetched
// but keep in mind that a request object is independant from the fetch algorithm used
// and rest object is the representation of the fetch algorithm
// we will also copy the concept of fetch(url, options)
// and fetch(request, options)
// in case options is null we can use request directly
// else we must make a combination of request & options on a new request object

// en gros rest doi permettre d'omettre les arguments uri et options pour qu'un objet request qu'on lui passe en hérite

var rest = proto.extend('Rest', {
    uri: null,
    headers: {},
    body: undefined,

    constructor(uri, options) {
        this.uri = env.createURI(uri);

        // tod: handle the options argument, which has the same signature has the request options

        this.Request = Request;
        this.ResponseGenerator = ResponseGeneratorWithServices.extend({services: []});
        this.services = this.ResponseGenerator.services;
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

    createRequest(uri, options = {}) {
        var restOptions = {uri: this.uri, headers: this.headers, body: this.body};
        var requestOptions = Object.assign(restOptions, options);

        return this.Request.create(requestOptions);
    },

    // service properties
    createService(options) {
        return Service.extend(options);
    },

    use(service) {
        this.services.push(service);
        // note : take into account service.priority and sort them
        return service;
    },

    findServiceByName(name) {
        return this.services.find(function(service) {
            return service.name === name;
        });
    },

    findServiceMatch(request) {
        return this.ResponseGenerator.match(request);
    },

    removeService(service) {
        this.services.splice(this.services.indexOf(service), 0, 1);
        return this;
    },

    // generating response
    createResponsePromiseForRequest(request) {
        var responseGenerator = this.ResponseGenerator.create(request);
        return responseGenerator;
    },

    fetch() {
        var request;
        var responsePromise;

        if (this.Request.isPrototypeOf(arguments[0])) {
            request = arguments[0].clone(); // clone the request to keep model untouched
            responsePromise = this.createResponsePromiseForRequest(request);
        } else {
            var uri = arguments[0];
            var options = arguments[1] || {};

            try {
                options.uri = uri;
                request = this.createRequest(options);
                responsePromise = this.createResponsePromiseForRequest(request);
            } catch (e) {
                responsePromise = Promise.reject(e);
            }
        }

        return responsePromise;
    },

    get(uri, options = {}) {
        options.method = 'GET';

        return this.fetch(uri, options);
    },

    post(uri, body, options = {}) {
        options.method = 'POST';
        options.body = body;

        return this.fetch(uri, options);
    },

    put(uri, body, options = {}) {
        options.method = 'PUT';
        options.body = body;

        return this.fetch(uri, options);
    },

    delete(uri, options = {}) {
        options.method = 'DELETE';

        return this.fetch(uri, options);
    }
});

rest.constructor(env.baseURI);

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
