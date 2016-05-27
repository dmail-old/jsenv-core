import fs from '@node/fs';
import http from '@node/http';
import https from '@node/https';

function fetchFile(url) {
    var filepath = url.slice('file:///'.length);

    return new Promise(function(resolve, reject) {
        fs.readFile(filepath, function(error, content) {
            if (error) {
                reject(error);
            } else {
                resolve({
                    status: 200,
                    text: String(content)
                });
            }
        });
    });
}

function fetchHttp(url) {
    return new Promise(function(resolve, reject) {
        var isHttps = url.protocol === 'https:';
        var options = {
            method: 'GET',
            host: url.hostname,
            port: isHttps ? 443 : 80,
            path: '/' + url.pathname,
            headers: {}
        };
        var httpRequest = (isHttps ? https : http).request(options);

        httpRequest.on('response', function(incomingMessage) {
            // faudrais read tout le incoming message stream puis resolve
            resolve({
                status: incomingMessage.statusCode,
                text: ''
            });
        });
        httpRequest.on('error', reject);
        httpRequest.end();
    });
}

function fetch(url) {
    url = new URL(url);

    if (url.protocol === 'file:') {
        return fetchFile(url);
    }
    return fetchHttp(url);
}

export default fetch;
