/* eslint-env browser */

import rest from 'env/rest';

// https://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
// thoose headers may throw error when you try to set them in a browser agent
// chrome will for instance.
// for now we just ignore it request headers contains one of them
var unsafeHeaders = [
    'accept-charset',
    'accept-encoding',
    'access-control-request-headers',
    'access-control-request-method',
    'connection',
    'content-length',
    'cookie',
    'cookie2',
    'date',
    'dnt',
    'expect',
    'host',
    'keep-alive',
    'origin',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'user-agent',
    'via'
];

function transport(request) {
    var xhr = new XMLHttpRequest();

    var promise = request.text().then(function(text) {
        return new Promise(function(resolve, reject) {
            xhr.onerror = function(e) {
                reject(e);
            };

            var responseBody = rest.createBody();
            var offset = 0;
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 2) {
                    resolve({
                        status: xhr.status,
                        headers: xhr.getAllResponseHeaders(),
                        body: responseBody
                    });
                } else if (xhr.readyState === 3) {
                    var data = xhr.responseText;

                    if (offset) {
                        data = data.slice(offset);
                    }
                    offset += data.length;

                    responseBody.write(data);
                } else if (xhr.readyState === 4) {
                    responseBody.close();
                }
            };

            // avoid browser cache by adding a param
            if (request.cacheMode === 'no-cache' || request.cacheMode === 'no-store') {
                request.uri.searchParams.set('r', String(Math.random() + 1).slice(2));
            }

            xhr.open(request.method, String(request.uri));

            request.headers.forEach(function(headerName, headerValue) {
                if (unsafeHeaders.includes(headerName)) {
                    // maybe a warning to throw a specific error
                    // for now we just ignore the header this way the request object contains
                    // the intent to set un unsafe header but does not throw an error when beign transported in the browser
                    // -> better : send x-headerName-override so server decide what to do
                    xhr.setRequestHeader('x-' + headerName + '-override', headerValue);
                } else {
                    xhr.setRequestHeader(headerName, headerValue);
                }
            });

            xhr.send(request.body ? text : null);
        });
    });

    promise.abort = function() {
        xhr.abort();
        xhr.onreadystatechange = null;
        xhr.onerror = null;
    };

    return promise;
}

export default transport;
