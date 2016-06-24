import Middleware from './middleware.js';

const AutoRequestHeader = Middleware.extend('AutoRequestHeaderMiddleware', {
    headerName: null,

    constructor(headerName, createHeaderValue) {
        this.headerName = headerName;
        this.createHeaderValue = createHeaderValue;
    },

    prepare(request) {
        if (request.headers.has(this.headerName)) {
            return request;
        }

        return Promise.resolve(this.createHeaderValue(request)).then(function(headerValue) {
            request.headers.set(this.headerName, headerValue);
        }.bind(this));
    }
});

export default AutoRequestHeader;
