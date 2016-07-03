/*

- missing detection of recursive redirections
- browser follow redirection by default it's doesn't need this however request with redirectMode to something else than follow
will not be respected, using the fetch API I could get control on all this

*/

import Request from '../../request.js';
import Response from '../../response.js';
import {NetWorkError} from '../../response-generator.js';

import Middleware from '../middleware.js';

const redirectStatus = [301, 302, 307];

function responseStatusIsRedirect(responseStatus) {
    return redirectStatus.includes(responseStatus);
}

function responseHasRedirectStatus(response) {
    return responseStatusIsRedirect(response.status);
}

var permanentRedirections = new Map();
function getRedirectedURI(uri) {
    var originalOrRedirectedURI = uri;

    while (permanentRedirections.has(originalOrRedirectedURI)) {
        originalOrRedirectedURI = permanentRedirections.get(originalOrRedirectedURI);
    }

    return originalOrRedirectedURI;
}

Request.defaultOptions.redirectLimit = 20;
Request.defaultOptions.redirectMode = 'follow'; // 'error', 'manual'
Request.redirectCount = 0;

Response.redirectCount = 0;

const Redirect = Middleware.extend('RedirectMiddleware', {
    prepare(request) {
        var originalOrRedirectedURI = getRedirectedURI(request.uri);

        if (originalOrRedirectedURI !== request.uri) {
            request.uri = originalOrRedirectedURI;
        }

        return request;
    },

    intercept(request, response) {
        if (response.headers.has('location') && responseHasRedirectStatus(response)) {
            var isTemporaryRedirect = response.status === 307;
            var locationHeaderValue = response.headers.get('location');
            var redirectionURI = request.uri.resolve(locationHeaderValue); // support relative location

            if (request.redirectMode === 'error') {
                throw new NetWorkError('request do not accept any redirection');
            }
            if (request.redirectMode === 'follow') {
                if (request.redirectCount >= request.redirectLimit) {
                    throw new NetWorkError('request redirection limit reached');
                }
                request.redirectCount++;

                if (response.body) {
                    response.body.cancel(); // don't consume the response body
                }

                // register permnant redirection to avoid further call to redirected uri
                if (isTemporaryRedirect === false) {
                    permanentRedirections.set(request.uri, redirectionURI);
                }

                // retry the request at a different uri
                return request.responseGenerator.redirect(redirectionURI);
            }
        }

        // response.redirectCount = request.redirectCount;

        return response;
    }
});

export default Redirect;
