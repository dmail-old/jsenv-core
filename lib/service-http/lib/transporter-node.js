import env from 'env';
import rest from 'env/rest';

import http from '@node/http';
import https from '@node/https';

var defaultHeaders = {
    'user-agent': 'node',
    origin: env.baseURI.pathname
};

function transport(request) {
    var key;
    for (key in defaultHeaders) {
        if (request.headers.has(key) === false) {
            request.headers.set(key, defaultHeaders[key]);
        }
    }

    var httpRequest;
    var aborted = false;

    var promise = new Promise(function(resolve, reject) {
        var uri;
        var isHttps;
        var headers;
        var options;

        uri = request.uri;
        isHttps = uri.protocol === 'https';
        headers = request.headers.toJSON();

        // quick fix just to prevent node from crashing because it does not support passing array as values
        // I have to investigate why but It may be the way node js works, so I'll have to find a workaround
        // for multiple headers like cookies
        for (key in headers) {
            if (Array.isArray(headers[key]) && headers[key].length === 1) {
                headers[key] = headers[key][0];
            }
        }

        options = {
            method: request.method,
            host: uri.hostname,
            port: /* uri.port || */(isHttps ? 443 : 80),
            path: '/' + uri.ressource,
            headers: headers
        };

        httpRequest = (isHttps ? https : http).request(options);

        httpRequest.on('response', function(incomingMessage) {
            resolve({
                status: incomingMessage.statusCode,
                headers: incomingMessage.headers,
                body: rest.createBody(incomingMessage)
            });
        });

        httpRequest.on('abort', function() {
            promise.onabort();
        });

        function handleError(e) {
            if (e && e.code === 'ECONNRESET') {
                console.log('aborted request');
                if (aborted) {
                    return e;
                }
                promise.abort();
            } else {
                console.log('error', e);
                reject(e);
            }
        }

        if (request.body) {
            request.body.pipeTo(httpRequest).then(
                function() {
                    httpRequest.end();
                },
                handleError
            );
        } else {
            httpRequest.on('error', handleError);
            httpRequest.end();
        }
    });

    promise.httpRequest = httpRequest;

    promise.onabort = function() {
        aborted = true;
    };

    promise.abort = function() {
        aborted = true;
        if (httpRequest) {
            httpRequest.abort();
            httpRequest.removeAllListeners('response');
        }
    };

    return promise;
}

export default transport;
