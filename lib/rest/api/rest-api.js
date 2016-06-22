// URITemplate
// RestAPI
// RestAPIRoute
// RestAPICall
// AuthorizationHandler

/*

api a plusieur route qui ont plusieurs méthode qui peut avoir UNE SEULE fonction associé avec par contre
des arguments variables

typiquement voici ce qu'on peut avoir

GET http://google.com
GET http://google.com?test=true

pour la même route deux méthode différente, ou alors c'est la même avec des params différent -> oui

chaque route doit hériter des uri, headers, params de l'api
chaque méthode hérite de la même manière de uri, headers, params

*/

// import proto from 'env/proto';
import URITemplate from 'env/uri-template';

import rest from '../index.js';

// a rest API route is a rest API as well because you can do GET/POST/PUT on the restURI origin
// in short doing restURI.route must create a restURI object which inherit from uri, requestOptions & services of the parent restURI
// restAPI will be the object used to descript how a method must be called, doing restURI.get(), post() involves restAPI objects
const RestURI = rest.extend('RestURI', {
    uri: null,

    constructor(uri, options) {
        this.uri = URITemplate.create(uri);
        this.options = options;
    },

    // rest api have default options for a request, you can override them with the options arguments
    createRequest(uri, options) {
        var apiOptions = this.options;
        var requestOptions;

        if (options) {
            requestOptions = Object.assign({}, this.options, options);
            if ('headers' in apiOptions) {
                if (('headers' in options) === false) {
                    delete requestOptions.headers;
                }
            }
        } else {
            requestOptions = apiOptions;
        }

        var request = rest.createRequest.call(this, uri, requestOptions);

        if ('headers' in apiOptions) {
            request.headers.populate(apiOptions.headers);
        }

        return request;
    }
});

rest.methods.forEach(function(methodName) {
    RestURI[methodName] = function(params, options) {
        // do something with the params, as adding them to the uri, or to the request body
        // there is also the options arg if you really want to override some option but it's recommended
        // to use middleware for this purpose

        return rest[methodName].call(this, this.uri, options);
    };
});

export default RestURI;
