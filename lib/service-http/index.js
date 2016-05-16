import transport from './lib/transporter-#{jsenv|default.agent.type}.js';
import rest from '../rest/index.js';

var HttpService = rest.createService({
    name: 'service-http',

    match(request) {
        return request.url.protocol === 'http:' || request.url.protocol === 'https:';
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
