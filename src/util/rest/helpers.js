import Url from '@jsenv/url';

export {default as createFileService} from './file-service.js';

function syncWithServer(rest, server) {
    function createRequestFromNodeRequest(nodeRequest) {
        const requestProperties = {
            method: nodeRequest.method,
            url: Url.create(nodeRequest.url, server.url).toString(),
            headers: nodeRequest.headers
        };
        if (
            requestProperties.method === 'POST' ||
            requestProperties.method === 'PUT' ||
            requestProperties.method === 'PATCH'
        ) {
            requestProperties.body = nodeRequest;
        }

        const request = rest.createRequest(requestProperties);
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
    function requestHandler(nodeRequest, nodeResponse) {
        var request = createRequestFromNodeRequest(nodeRequest);
        console.log(request.method, request.url.toString());
        // console.log('myRest base url', myRest.baseUrl.toString());
        // console.log('httpRequest url', httpRequest.url);
        // console.log('request url', request.url.toString());

        rest.fetch(request).then(function(response) {
            syncNodeResponseAndResponse(response, nodeResponse);
        }).catch(function(e) {
            nodeResponse.writeHead(500);
            nodeResponse.end(e ? e.stack : '');
        });
    }
    server.requestHandler = requestHandler;
}
export {syncWithServer};

function use(rest, service) {
    rest.use(service);
}
export {use};

function handle(rest, match, handle) {
    return use(rest, {
        match: match,
        handle: handle
    });
}
export {handle};

function route(rest, match, handlers) {
    return use(rest, {
        match: match,
        methods: handlers
    });
}
export {route};

function transformResponse(rest, transformer) {
    return rest.use({
        intercept: transformer
    });
}
export {transformResponse};

function enableCors(rest) {
    const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].join(', '),
        'access-control-allow-headers': ['x-requested-with', 'content-type', 'accept'].join(', '),
        'access-control-max-age': 1 // Seconds
    };

    return transformResponse(rest, (request, response) => {
        Object.keys(corsHeaders).forEach(function(corsHeaderName) {
            response.headers.append(corsHeaderName, corsHeaders[corsHeaderName]);
        });
    });
}
export {enableCors};

function createHTMLResponse(html) {
    return {
        status: 200,
        headers: {
            'content-type': 'text/html',
            'content-length': Buffer.byteLength(html)
        },
        body: html
    };
}
export {createHTMLResponse};

function createJSResponse(js) {
    return {
        status: 200,
        headers: {
            'content-type': 'application/javascript',
            'content-length': Buffer.byteLength(js)
        },
        body: js
    };
}
export {createJSResponse};

// server.redirect = fn => {
//     server.use({
//         match(request) {
//             const redirection = fn(request);
//             if (redirection) {
//                 request.url = request.url.resolve(redirection);
//             }
//         }
//     });
// };
