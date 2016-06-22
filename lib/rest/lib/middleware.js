/*
Service objects are used to interact on response generation for a given request
*/

import proto from 'env/proto';

var Middleware = proto.extend('Middleware', {
    constructor(options = {}) {
        Object.assign(this, options);
    },

    name: undefined, // NOTE : à supprimer en faveur de constructor.name je pense

    // hook called to transform the request before any match/methods/handle hook
    prepare(/* request */) {

    },

    // hook called to know if the service is handling the request
    match(/* request */) {
        return false;
    },

    // hooks called depending on the request method if request has matched
    methods: {},

    // Hook called once request's response is created
    intercept(/* request, response */) {}
});

export default Middleware;
