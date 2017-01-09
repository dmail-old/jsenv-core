/*

// I have to create service
// idéalement un petit routeur serait pratique genre
// rest.route('path').get(function() {}) ->
// et boum sur le get à cette route la fonction est chargée de produire une réponse
// bon j'ai besoin de quoi ?
// en gros le client va se connecter et demander au serveur les polyfill et communiquer son profile
// pour qu'on puisse connaitre les options babel
// le serveur doit alors lui renvoyer un fichier js contenant tout les polyfills nécéssaire
// puis lui fournir le premier fichier d'entrée qu'on souhaite éxécuter
// ce fichier sera alors fourni par une autre partie du code
// qui va transpiler et renvoyer ça au client
// c'est le but de tout ça pour le moment

*/

import env from '@jsenv/env';

import Headers from './headers.js';
import Body from './body.js';
import Response from './response.js';
import Request from './request.js';
import Service from './service.js';
import ResponseGeneratorWithServices from './response-generator-service.js';

// import polymorph from './util/polymorph.js';

import compose from '@jsenv/compose';

const rest = compose('Rest', {
    constructor(uri) {
        this.Request = Request.compose({
            baseURI: env.createURI(uri)
        });
        this.ResponseGenerator = ResponseGeneratorWithServices.compose({services: []});
        this.services = this.ResponseGenerator.services;
    },

    createURI() {
        return this.Request.baseURI.clone();
    },

    createHeaders(properties) {
        return Headers.create(properties);
    },

    createBody(data) {
        return Body.create(data);
    },

    createResponse(properties) {
        return Response.create(properties);
    },

    createRequest(properties) {
        return this.Request.create(properties);
    },

    // service properties
    createService(options) {
        return Service.create(options);
    },

    use(service) {
        if (Service.isPrototypeOf(service) === false) {
            service = Service.create(service);
        }

        // ptet réutiliser branch + preferBranch ? (polymorphisme)
        // ici on a par contre un polymorphisme asynchrone aussi (uniquement pour handleRequest)
        // la partie handleResponse n'a pas de match() + methods{} juste un intercept()
        // autrement dit handleResponse = Sequence
        // et handleRequest = branch
        // mais dans le deux cas ils sont asynchrone
        // reste que les service sont une bonne manière de les gérer
        // en tous cas polymorph sera réutiliser à des moments parce que ça déchire tout
        // en attendant on reste sur des services mais on va rapidement basculer sur kk chose comme ça

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
        if (this.Request.isPrototypeOf(arguments[0])) {
            return this.createResponsePromiseForRequest(arguments[0]);
        }

        var uri = arguments[0];
        var options = arguments[1] || {};
        var request;

        try {
            options.uri = uri;
            request = this.createRequest(options);
        } catch (e) {
            return Promise.reject(e);
        }

        return this.fetch(request);
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
