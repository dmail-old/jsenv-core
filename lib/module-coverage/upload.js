/* global __moduleName */

import Iterable from 'env/iterable';
import Thenable from 'env/thenable';

import rest from 'env/rest';
import httpService from 'env/service-http';

let contexts = ['jenkins', 'travis', 'file-git'];

function createMatchedContextPromise(env) {
    var matchedIterablePromise = Iterable.map(contexts, function(contextName) {
        return Promise.resolve(contextName).then(function(contextName) {
            return env.importDefault('./context/' + contextName + '.js', __moduleName);
        }).then(function(context) {
            return Thenable.callFunction(context.detect, context, process.env).then(function(matched) {
                return matched ? context : null;
            });
        });
    });

    return Iterable.reduceToThenable(matchedIterablePromise, undefined, function(context) {
        return Boolean(context);
    });
}

let codecovAPI = rest.create('https://codecov.io/upload/v2');
codecovAPI.use(httpService);

function uploadCoverage(env, jsonString, token) {
    return createMatchedContextPromise(env).then(function(matchedContext) {
        if (!matchedContext) {
            throw new Error("unknown context. cannot upload coverage");
        }
        console.log(matchedContext.name, 'context detected');
        return matchedContext.config(process.env);
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

        // https://github.com/cainus/codecov.io/blob/master/lib/sendToCodeCov.io.js#L25
        // https://github.com/request/request/blob/master/request.js
        // https://github.com/form-data/form-data/blob/master/lib/form_data.js
        // https://github.com/request/request/blob/master/request.js#L1185

        return codecovAPI.post(uri, body, {
            headers: {
                accept: 'text/plain',
                'content-type': 'text/plain',
                'content-length': Buffer.byteLength(jsonString)
            }
        });
    }).then(function(response) {
        return response.text().then(function(text) {
            console.log('coverage upload url', text);
        });
    });
}

export default uploadCoverage;
