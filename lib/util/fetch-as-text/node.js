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

function fetchHttpOrHttps(url, isHttps) {
    return new Promise(function(resolve, reject) {
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

function fetchHttp(url) {
    return fetchHttpOrHttps(url, false);
}

function fetchHttps(url) {
    return fetchHttpOrHttps(url, true);
}

export default {
    http: fetchHttp,
    https: fetchHttps,
    file: fetchFile
};
