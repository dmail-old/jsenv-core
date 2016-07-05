// import env from 'env';
import proto from 'env/proto';
// import URI from 'env/uri';
import URITemplate from 'env/uri-template';
import Item from 'env/item';
import base64 from 'env/base64';

import Headers from './headers.js';
import Body from './body.js';
import Response from './response.js';
import Request from './request.js';
import Middleware from './middleware/middleware.js';
import ResponseGenerator from './middleware/response-generator.js';

// import polymorph from './util/polymorph.js';

const rest = proto.extend('Rest', {
    defaultOptions: {
        middlewares: []
    },

    constructor(uri, options = {}) {
        this.uriTemplate = URITemplate.create(uri);
        this.options = Item.concat(this.defaultOptions, options);
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
        var selfOptions = this.options;
        var requestOptions;
        if (options) {
            requestOptions = Item.concat(selfOptions, options);
        } else {
            requestOptions = selfOptions;
        }

        return Request.create(uri, requestOptions);
    },

    createMiddleware(options) {
        return Middleware.extend(options);
    },

    // use(middleware) {
    //     this.middlewares.push(middleware);
    //     // note : take into account service.priority and sort them ?
    //     return middleware;
    // },

    // findMiddlewareMatch(request) {
    //     return this.ResponseGenerator.match(request);
    // },

    // removeMiddleware(service) {
    //     this.middlewares.splice(this.middlewares.indexOf(service), 0, 1);
    //     return this;
    // },

    createResponsePromiseForRequest(request, options) {
        var responseGenerator = ResponseGenerator.create(request, options);
        return responseGenerator.open();
    },

    fetch(uriOrRequest, options) {
        var request;
        var responsePromise;

        if (Request.isPrototypeOf(uriOrRequest)) {
            responsePromise = this.createResponsePromiseForRequest(request, options);
        } else {
            var uri = uriOrRequest;

            try {
                request = this.createRequest(uri);
                responsePromise = this.createResponsePromiseForRequest(request, options);
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
    rest.defaultOptions.params = {};
    rest.methods = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'];

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

    var paramKeywords = [
        {
            name: 'required',
            fn(parameter) {
                if (parameter.hasValue === false) {
                    throw new Error(parameter.name + ' is required');
                }
            }
        },
        {
            name: 'type',
            fn(parameter) {
                if (typeof parameter !== parameter.definition.type) {
                    throw new Error(parameter.name + ' type must be' + parameter.definition.type);
                }
            }
        },
        {
            name: 'format',
            fn() {
                if (parameter.hasValue) {
                    var format = parameter.definition.format;
                    if (format === 'base64') {
                        parameter.value = base64.encode(parameter.value);
                    } else if (format !== 'default') {
                        throw new Error('unkown parameter format ' + format);
                    }
                }
            }
        }
    ];

    function getParamKeyword(name) {
        var paramKeyword = paramKeywords.find(function(paramKeyword) {
            return paramKeyword.name === name;
        });

        if (!paramKeyword) {
            throw new Error('no param named ' + name);
        }

        return paramKeyword;
    }

    rest.methods.forEach(function(methodName) {
        rest[methodName] = function(uriOrRequest, params, options = {}) {
            // handle required, type, default, format
            // ceci réutilisera l'objet keyword ou le concept de schéma
            // qui permet de faire des choses en fonction de mot clé présent dans un object js
            // actuellement ce n'est pas assez souple pour être réutilisé ici mais c'est le but
            var uriTemplate = this.uriTemplate;
            var paramDefinitions = this.params;

            // if we don't have any paramDefinition
            Object.keys(paramValues).forEach(function(paramName) {
                if (paramName in paramDefinitions === false) {
                    throw new Error('unexpected param ' + paramName);
                }

                var paramDefinition = paramDefinitions[paramName];
                var parameter = {
                    hasValue: true,
                    value: paramValues[paramName]
                };

                Object.keys(paramDefinition).forEach(function(paramDefinitionName) {
                    var paramKeyword = getParamKeyword(paramName);
                });


                parameterModel.fn(parameter);
            });

            // pour tous les params qui sont des parties de l'url, on les traite comme tel
            uriTemplate.expressions.forEach(function(expression) {

            });
            // les autres doivent aller dans le body (même pour une requête GET)


            // do something with the params, as adding them to the uri, or to the request body
            // there is also the options arg if you really want to override some option but it's recommended
            // to use middleware for this purpose

            // if there is a definition for this method get it, then from the merged definitions
            // create an apicall object

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

export const test = {
    modules: ['@node/assert'],

    main() {

    }
};
