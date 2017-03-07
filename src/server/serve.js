/*
- performance now polyfill :
https://gist.github.com/paulirish/5438650

*/

// import require from '@node/require';
// import env from '@jsenv/env';

import rest from '../rest/index.js';
import NodeServer from '../server/index.js';

// const fsAsync = require('./fs-async.js');
const serverUrl = 'http://localhost';
const myRest = rest.create(serverUrl);
// var options = {
//     cache: true
// };

// on ne sait pas encore coment on va faire ça donc touche à rien
// ok première chose à faire : un client se connecte
// on lui répond :

// a : donne moi un scan de ton implémentation en éxécutant des tests que je te donne
// b : on connait le scan mais pas le résultat des fix : éxécute flatten.js puis renvoit ce que ça donne
// c : on connait le scan et son résultat : éxécute juste flatten.js

const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].join(', '),
    'access-control-allow-headers': ['x-requested-with', 'content-type', 'accept'].join(', '),
    'access-control-max-age': 1 // Seconds
};
myRest.use({
    intercept(request, response) {
        Object.keys(corsHeaders).forEach(function(corsHeaderName) {
            response.headers.append(corsHeaderName, corsHeaders[corsHeaderName]);
        });
    }
});

function createJavaScriptResponse(content) {
    return Promise.resolve({
        status: 200,
        headers: {
            'content-type': 'application/javascript',
            'content-length': Buffer.byteLength(content)
        },
        body: content
    });
}
function getUserAgentStore() {
    // todo
    // doit créer un objet avec set/get
    // qui écrit/lit dans des fichiers correpsondant à ce userAgent
}
function getFix() {
    // todo
    // c'est polyfill.js + getAfterFlattenFeatures() qu'on mettra dans un store aussi
    // ensuite chaque fois qu'un client requête un fichier
    // on lit dabord si on a un fichier cache à jour (memoize)
    // sinon on lit dans son after-flatten report quels sont les plugins nécéssaires
    // et on renvoit cette info
}
function getBeforeFlattenFeatures() {
    // todo
    // on reprend ce qu'on a fait dans start.js
}
function sendFix(cache) {
    return Promise.all([
        cache.getAfterFlattenReport(),
        getFix()
    ]).then(function([afterReport, fix]) {
        return createJavaScriptResponse(fix).then(function(response) {
            response.headers.set('x-report-cached', Boolean(afterReport));
            return response;
        });
    });
}
function sendFeatures() {
    return getBeforeFlattenFeatures().then(createJavaScriptResponse);
}

myRest.use({
    match(request) {
        return (
            request.url.startsWith('compatibility') &&
            request.headers.has('user-agent')
        );
    },

    methods: {
        get(request) {
            var userAgent = request.headers.get('user-agent');

            return getUserAgentStore(userAgent).then(function(store) {
                return store.get('before-flatten-report').then(function(report) {
                    if (report) {
                        return sendFix(store);
                    }
                    return sendFeatures(store);
                });
            });
        },

        post(request) {
            var userAgent = request.headers.get('user-agent');

            return getUserAgentStore(userAgent).then(function(store) {
                return request.body.readAsString().then(JSON.parse).then(function(report) {
                    if (request.url.searchParams.get('when') === 'before') {
                        store.set('before-flatten-report', report);
                        return sendFix(store);
                    }
                    store.set('after-flatten-report', report);
                    return {
                        status: 204
                    };
                });
            });
        }
    }
});
/*
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

            let promise = fsAsync('stat', filepath).then(function(stat) {
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
                    return fsAsync('readFile', filepath).then(function(buffer) {
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
*/

function createRequestFromNodeRequest(nodeRequest) {
    const requestProperties = {
        method: nodeRequest.method,
        url: nodeRequest.url,
        headers: nodeRequest.headers
    };
    if (
        requestProperties.method === 'POST' ||
        requestProperties.method === 'PUT' ||
        requestProperties.method === 'PATCH'
    ) {
        requestProperties.body = nodeRequest;
    }

    const request = myRest.createRequest(requestProperties);
    return request;
}
function syncNodeResponseAndResponse(response, nodeResponse) {
    nodeResponse.writeHead(response.status, response.headers.toJSON());

    var keepAlive = response.headers.get('connection') === 'keep-alive';

    if (response.body) {
        if (response.body.pipeTo) {
            return response.body.pipeTo(nodeResponse);
        }
        if (response.body.pipe) {
            response.body.pipe(nodeResponse);
        } else {
            nodeResponse.write(response.body);
            if (keepAlive === false) {
                nodeResponse.end();
            }
        }
    } else if (keepAlive === false) {
        nodeResponse.end();
    }
}

const server = NodeServer.create(function(nodeRequest, nodeResponse) {
    var request = createRequestFromNodeRequest(nodeRequest);
    console.log(request.method, request.url.toString());
    // console.log('myRest base url', myRest.baseUrl.toString());
    // console.log('httpRequest url', httpRequest.url);
    // console.log('request url', request.url.toString());

    myRest.fetch(request).then(function(response) {
        syncNodeResponseAndResponse(response, nodeResponse);
    }).catch(function(e) {
        console.log(500, e.stack);
        nodeResponse.writeHead(500, corsHeaders);
        nodeResponse.end(e ? e.stack : '');
    });
});

server.onTransition = function(oldStatus, status) {
    if (status === 'opened') {
        console.log('jsenv opened at', this.url.href);
    } else if (status === 'closed') {
        console.log('jsenv closed');
    }
};
server.open(serverUrl).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});
