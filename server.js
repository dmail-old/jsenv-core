/*
run-report.json, or the content of the POST request
{
    url: 'http://localhost:80',
    date: Date.now(), // date when the execution occured (just before execution is actually runned)
    duration: performance.now() || process.hrtime() - performance.now() || process.hrtime()
    status: 'resolved', 'rejected',
    value: the exports for 'resolved', the throwed value for 'rejected'
}

// https://gist.github.com/paulirish/5438650

donc maintenant ce qu'il faut faire c'est qu'au lieu de retourner en dur "it works"
on va retourner le fichier correspondant pour chaque requête GET
(éventuellement check le header accept qui est set par systemjs à "application/x-es-module, *\/*")
et ne faire le truc avec babel que lorsque ce header est présent

// https://polyfill.io/v2/docs/features/

polyfill/
a.js
    object-assign + object-values
b.js
    empty

meta.json
    {
        "a": {
            features: [
                'object-assign',
                'object-values'
            ],
            agents: [
                'firefox@30.0',
                'chrome@45.0',
                'node@7.0'
            ]
        },
        "b": {
            features: [],
            agents: []
        }
    }

*/

import require from '@node/require';
import fs from '@node/fs';
import env from '@jsenv/env';

import rest from './src/rest/index.js';
import NodeServer from './src/server/index.js';

const serverUrl = 'http://localhost';
const babel = require('babel-core');
const myRest = rest.create(serverUrl);

function filesystem(method) {
    var args = Array.prototype.slice.call(arguments, 1);

    return new Promise(function(resolve, reject) {
        args.push(function(error, result) {
            if (error) {
                if (error instanceof Error) {
                    reject(error);
                } else {
                    resolve(error);
                }
            } else {
                resolve(result);
            }
        });

        fs[method].apply(fs, args);
    });
}

myRest.use({
    match(request) {
        return request.headers.get('accept').includes('application/x-es-module');
    },

    methods: {
        get(request) {
            const filepath = request.url.ressource;
            console.log('the file at', filepath);

            function transformFsError(error) {
                if (error) {
                    // https://iojs.org/api/errors.html#errors_eacces_permission_denied
                    if (error.code === 'EACCES') {
                        return {
                            status: 403
                        };
                    }
                    if (error.code === 'EPERM') {
                        return {
                            status: 403
                        };
                    }
                    if (error.code === 'ENOENT') {
                        return {
                            status: 404
                        };
                    }
                    // file access may be temporarily blocked
                    // (by an antivirus scanning it because recently modified for instance)
                    if (error.code === 'EBUSY') {
                        return {
                            status: 503,
                            headers: {
                                'retry-after': 0.01 // retry in 10ms
                            }
                        };
                    }
                    // emfile means there is too many files currently opened
                    if (error.code === 'EMFILE') {
                        return {
                            status: 503,
                            headers: {
                                'retry-after': 0.1 // retry in 100ms
                            }
                        };
                    }
                }
                return Promise.reject(error);
            }

            function transpile(code, filename) {
                const options = env.System.babelOptions || {};
                options.modules = 'system';
                if (options.sourceMap === undefined) {
                    options.sourceMap = 'inline';
                }
                // options.inputSourceMap = load.metadata.sourceMap;
                options.filename = filename;
                options.code = true;
                options.ast = false;
                const result = babel.transform(code, options);
                return result.code;
            }

            let promise = filesystem('stat', filepath).then(function(stat) {
                if (stat.isDirectory()) {
                    return {
                        status: 403
                    };
                }

                if (request.headers.has('if-modified-since')) {
                    // the request headers if-modified-since is not a valid date
                    let mtime;

                    try {
                        mtime = new Date(request.headers.get('if-modified-since'));
                    } catch (e) {
                        return 400;
                    }

                    if (stat.mtime <= mtime) {
                        return {
                            status: 304,
                            headers: {
                                'last-modified': stat.mtime.toUTCString()
                            }
                        };
                    }
                }

                const properties = {
                    status: 200,
                    headers: {
                        'last-modified': stat.mtime.toUTCString(),
                        'content-type': 'application/javascript',
                        'content-length': stat.size
                    }
                };

                if (request.method === 'GET') {
                    return filesystem('readFile', filepath).then(function(buffer) {
                        const fileContent = buffer.toString();
                        const transpiledContent = transpile(fileContent, filepath);
                        properties.body = transpiledContent;
                        properties.headers['content-length'] = Buffer.byteLength(transpiledContent);
                        return properties;
                    }, transformFsError);
                }
                return properties;
            }, transformFsError);

            return promise;
        }
    }
});

const server = NodeServer.create(function(httpRequest, httpResponse) {
    const requestProperties = {
        method: httpRequest.method,
        url: httpRequest.url,
        headers: httpRequest.headers
    };
    if (
        requestProperties.method === 'POST' ||
        requestProperties.method === 'PUT' ||
        requestProperties.method === 'PATCH'
    ) {
        requestProperties.body = httpRequest;
    }

    const request = myRest.createRequest(requestProperties);
    console.log(request.method, request.url.toString());
    // console.log('myRest base url', myRest.baseUrl.toString());
    // console.log('httpRequest url', httpRequest.url);
    // console.log('request url', request.url.toString());

    const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].join(', '),
        'access-control-allow-headers': ['x-requested-with', 'content-type', 'accept'].join(', '),
        'access-control-max-age': 1 // Seconds
    };

    myRest.fetch(request).then(function(response) {
        Object.keys(corsHeaders).forEach(function(corsHeaderName) {
            response.headers.append(corsHeaderName, corsHeaders[corsHeaderName]);
        });
        httpResponse.writeHead(response.status, response.headers.toJSON());

        var keepAlive = response.headers.get('connection') === 'keep-alive';

        if (response.body) {
            if (response.body.pipeTo) {
                return response.body.pipeTo(httpResponse);
            }
            if (response.body.pipe) {
                response.body.pipe(httpResponse);
            } else {
                httpResponse.write(response.body);
                if (keepAlive === false) {
                    httpResponse.end();
                }
            }
        } else if (keepAlive === false) {
            httpResponse.end();
        }
    }).catch(function(e) {
        console.log(500, e.stack);
        httpResponse.writeHead(500, corsHeaders);
        httpResponse.end(e ? e.stack : '');
    });
});

server.onTransition = function(oldStatus, status) {
    if (status === 'opened') {
        console.log('jsenv opened at', this.url.href);
    } else if (status === 'closed') {
        console.log('jsenv closed');
    }
};
server.open(serverUrl);
