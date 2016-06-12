import rest from 'env/rest';

import transport from './lib/transporter-#{jsenv|default.agent.type}.js';

var HttpService = rest.createService({
    name: 'service-http',

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

export default HttpService;
