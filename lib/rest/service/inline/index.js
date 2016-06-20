import rest from '../../../index.js';

const InlineService = rest.createService({
    name: 'inline',
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

export default InlineService;
