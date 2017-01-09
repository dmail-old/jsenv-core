import rest from './src/rest/index.js';

import NodeServer from './src/server/index.js';

const myRest = rest.create('./');

myRest.use({
    match() {
        return true;
    },

    methods: {
        '*': function() {
            return {
                status: 200,
                body: 'Hello world'
            };
        }
    }
});

const server = NodeServer.create(function(httpRequest, httpResponse) {
    const request = myRest.createRequest({
        method: httpRequest.method,
        url: httpRequest.url,
        headers: httpRequest.headers,
        body: httpRequest
    });
    // no body allowed for get/head request
    // dont faudrais ne passer body qu si la méthode est post, put, patch ?

    myRest.fetch(request).then(function(response) {
        // Object.assign(response.headers, {
        //     'access-control-allow-origin': '*',
        //     'access-control-allow-methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].join(', '),
        //     'access-control-allow-headers': ['x-requested-with', 'content-type', 'accept'].join(', '),
        //     'access-control-max-age': 1 // Seconds
        // });
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
        httpResponse.writeHead(500);
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
server.open('http://localhost');
