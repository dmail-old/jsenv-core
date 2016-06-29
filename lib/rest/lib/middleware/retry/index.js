// note : http://stackoverflow.com/questions/15155014/inconsistent-browser-retry-behaviour-for-timed-out-post-requests
// http://www.w3.org/Protocols/rfc2616/rfc2616-sec8.html#sec8.2.4
// in short: when request is closed before any response is received, retry it (but browser will do it auto)
// so only node should implement this behaviour

import Middleware from '../middleware.js';

const retryStatus = [301, 302, 307, 503];

function responseStatusIsRetry(responseStatus) {
    return retryStatus.includes(responseStatus);
}

function responseHasRetryStatus(response) {
    return responseStatusIsRetry(response.status);
}

function getRetryHeaderValueInMs(retryHeaderValue) {
    var ms;
    if (typeof retryHeaderValue === 'string') {
        if (isNaN(retryHeaderValue)) {
            try {
                retryHeaderValue = new Date(retryHeaderValue);
            } catch (e) {
                throw e;
            }
        } else {
            var seconds;
            if (retryHeaderValue % 1 === 0) {
                seconds = parseInt(retryHeaderValue);
            } else {
                seconds = parseFloat(retryHeaderValue);
            }
            ms = seconds * 1000; // delay headers is in seconds but we need ms
        }
    }
    if (retryHeaderValue instanceof Date) {
        ms = retryHeaderValue - new Date();
    }
    if (typeof ms !== 'number') {
        throw new TypeError('delay expects a date or a number');
    }
    if (ms < 0) {
        throw new RangeError('delay must be a future date or a positive number');
    }

    return ms;
}

const Retry = Middleware.extend('RetryMiddleware', {
    intercept(request, response) {
        let retryDelay;

        if (response.headers.has('retry-after') && responseHasRetryStatus(response)) {
            retryDelay = getRetryHeaderValueInMs(response.headers.get('retry-after'));
        }

        if (typeof retryDelay === 'number') {
            response.lastRetry = retryDelay;

            if (response.body) {
                response.body.cancel(); // don't consume the response body
            }

            return request.responseGenerator.retryAfter(retryDelay);
        }

        return response;
    }
});

export default Retry;
