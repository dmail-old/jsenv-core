/*
Service objects are used to interact on response generation for a given request
*/

import compose from '@jsenv/compose';

const Service = compose('Service', {
    name: undefined, // NOTE : à supprimer en faveur de constructor.name je pense

    // hook called to know if the service is handling the request
    match(/* request */) {
        return false;
    },

    // hooks called depending on the request method if request has matched
    methods: {},

    // Hook called once request's response is created
    intercept(/* request, response */) {},

    constructor(options = {}) {
        Object.assign(this, options);
    }
});

export default Service;
