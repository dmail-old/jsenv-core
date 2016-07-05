import Timeout from 'env/timeout';

import Middleware from '../middleware.js';

Request.defaultOptions.timeout = 1000; // req/res timeout in ms, 0 to disable, timeout is reseted on redirect
// timeout is reseted becasuse redirect create a new request and this a new timeout, it's how it works
// Request.expire = function() { this.timeout.expire(); }

function createTimeoutError(ms) {
    var error = new Error('still waiting to get a response after ' + ms);
    error.name = 'NetWorkError';
    error.code = 'REQUEST_TIMEOUT';
    return error;
}

const RequestTimeoutMiddleware = Middleware.extend('RequestTimeoutMiddleware', {
    requestConstructor() {
        // the presence of a requestConstructor create a middleware per request allowing
        // to get one middleware object per request
    },

    prepare(request) {
        this.timeout = Timeout.create(request.timeout);
        this.timeout.then(function() {
            // when timeout is reached we inform resoonseGenerator of it
            request.responseGenerator.reject(createTimeoutError(this.timeout.value));
        }.bind(this));
    },

    intercept() {
        this.timeout.clear();
    }
});

export default RequestTimeoutMiddleware;
