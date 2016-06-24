import Middleware from '../middleware.js';

import transport from './transporter-#{jsenv|default.agent.type}.js';

const Http = Middleware.extend('HttpMiddleware', {
    match(request) {
        return request.uri.protocol === 'http' || request.uri.protocol === 'https';
    },

    transport(request) {
        var promise = transport(request);

        // how to abort response generation ?
        promise.onabort = function() {

        };

        return promise;
    },

    methods: {
        '*'(request) {
            return this.transport(request);
        }
    }
});

export default Http;
