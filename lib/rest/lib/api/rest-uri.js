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
// import proto from 'env/proto';
import Item from 'env/item';

import rest from '../index.js';
// import Request from '../request.js';

// const RestAPISignature = proto.extend('RestAPISignature', {
//     method: undefined,
//     params: undefined,

//     constructor(uriTemplate, method, params) {
//         this.uriTemplate = uriTemplate;
//         this.method = method;
//         this.params = params;
//     },

//     fetch(params, options) {

//     }
// });

// a rest API route is a rest API as well because you can do GET/POST/PUT on the restURI origin
// in short doing restURI.route must create a restURI object which inherit from uri, requestOptions & services of the parent restURI
// restAPI will be the object used to descript how a method must be called, doing restURI.get(), post() involves restAPI objects
const RestURI = rest.extend('RestURI', {
    uri: null,
    defaultOptions: {
        methods: {}
    },

    constructor(uri, options = {}) {
        this.uriTemplate = URITemplate.create(uri);
        // the problem with merge is taht it clones everything and if the structure contains pure elements
        // the cloning is useless because thoose elements dont need to be cloned
        // for instance the services array will contain a list of services but thoose services are pure they dont have to be cloned
        // more over merge requires a second argument while it's optionnal
        // what we really need in fact is proto.extend.call(a, b); but without inheritance over a

        // what I really need for the options object is defaultOptions which are used everywhere
        // and optional customOptions
        // i need a resulting optiosn object, merge does that perfectly BUT
        // it clones object while it's not always mandatory
        // the concat method does what we want
        this.options = Item.concat(this.options, options);
    },

    // rest api have default options for a request, you can override them with the options arguments
    createRequest(uri, options) {
        var apiOptions = this.options;
        var requestOptions;
        if (options) {
            requestOptions = Item.concat(apiOptions, options);
        } else {
            requestOptions = apiOptions;
        }

        var request = rest.createRequest.call(this, uri, requestOptions);

        return request;
    },

    defineMethod(methodName, methodDefinition) {
        this.options.methods[methodName] = methodDefinition;
    },

    defineRoute(routePath, routeDefinition) {
        var routeOptions = Item.concat(this.options, routeDefinition);
        var routeURI = RestURI.create(this.uriTemplate.resolve(routePath), routeOptions);

        return routeURI;
    }
});

rest.methods.forEach(function(methodName) {
    RestURI[methodName] = function(params, options) {
        // do something with the params, as adding them to the uri, or to the request body
        // there is also the options arg if you really want to override some option but it's recommended
        // to use middleware for this purpose

        // if there is a definition for this method get it, then from the merged definitions
        // create an apicall object

        // return RestAPI.create(this.uri, methodName);
        // rest[methodName].call(this, this.uri, options);
        return [params, options];
    };
});

export default RestURI;
