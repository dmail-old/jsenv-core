import rest from '../../../index.js';

const InlineMiddleware = rest.createMiddleware({
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

export default InlineMiddleware;
