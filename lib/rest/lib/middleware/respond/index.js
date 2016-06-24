import Middleware from '../middleware.js';

const Respond = Middleware.extend('RespondMiddleware', {
    name: 'inline',
    responses: {},

    match(request) {
        return request.uri.pathname in this.responses;
    },

    methods: {
        '*'(request) {
            return this.responses[request.uri.pathname]();
        }
    }
});

export default Respond;
