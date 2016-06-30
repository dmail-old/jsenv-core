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
    prepare(request) {
        // a clean way to do would be to have a weakmap of timeout per request
        // because I know what I'm doing I'll put a property on the request object

        request.timeout = Timeout.create(request.timeout);
        request.timeout.then(function() {
            // when timeout is reached we inform resoonseGenerator of it
            request.responseGenerator.reject(createTimeoutError(request.timeout.value));
        });
    },

    intercept(request) {
        request.timeout.clear();
    }
});

export default RequestTimeoutMiddleware;
