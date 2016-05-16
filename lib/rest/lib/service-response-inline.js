import rest from '../index.js';

var FakeService = rest.createService({
    name: 'service-response-inline',
    responses: {},

    match(request) {
        return request.url.pathname in this.responses;
    },

    methods: {
        '*'(request) {
            return this.responses[request.url.pathname]();
        }
    }
});

export default FakeService;
