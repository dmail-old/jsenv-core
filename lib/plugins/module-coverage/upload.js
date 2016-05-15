/* global __moduleName */

// import jsenv from 'jsenv';
import Iterable from 'jsenv/iterable';
import Thenable from 'jsenv/thenable';

import rest from '../../../node_modules/@dmail/rest/index.js';
import httpService from '../../../node_modules/@dmail/service-http/index.js';

let environments = ['jenkins', 'travis', 'file-git'];

function createMatchedEnvPromise() {
    var matchedIterablePromise = Iterable.map(environments, function(envName) {
        return Promise.resolve(envName).then(function(envName) {
            return System.import('./env/' + envName + '.js', __moduleName);
        }).then(function(exports) {
            return exports.default;
        }).then(function(env) {
            return Thenable.callFunction(env.detect, env, process.env).then(function(matched) {
                return matched ? env : null;
            });
        });
    });

    return Iterable.reduceToThenable(matchedIterablePromise, undefined, function(env) {
        return Boolean(env);
    });
}

let codecovAPI = rest.create('https://codecov.io/upload/v2');
codecovAPI.use(httpService);

function uploadCoverage(jsonString, token) {
    return createMatchedEnvPromise().then(function(matchedEnv) {
        if (!matchedEnv) {
            throw new Error("unknown env. could not get meta");
        }
        return matchedEnv.config(process.env);
    }).then(function(config) {
        var uri = codecovAPI.createURI();
        var body = codecovAPI.createBody(jsonString);

        Object.keys(config).forEach(function(key) {
            uri.searchParams.set(key, config[key]);
        });

        if (token) {
            uri.searchParams.set('token', token);
        }
        uri.searchParams.set('package', 'node');

        // https://github.com/form-data/form-data/blob/master/lib/form_data.js

        return codecovAPI.post(uri, body, {
            headers: {
                // accept: "text/plain",
                'content-type': 'multipart/form-data',
                // 'content-type': "application/x-www-form-urlencoded; charset=utf-8",
                'content-length': Buffer.byteLength(jsonString) // body.length
            }
        });
    }).then(function(response) {
        return response.text().then(function(text) {
            console.log('here is the response from codecov', text);
        });
    });
}

export default uploadCoverage;
