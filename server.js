/*
pour pouvoir run un fichier on va avoir besoin d'un premier truc c'est d'envoyer
au client lorsqu'il le demande le code qu'il doit éxécuter
pour le moment ce sera toujours le même code genre 'console.log('it works');'

pour cela il faut démarrer un client
par exemple ouvrir son navigateur avec un index.html spécifique
qui va charger jsenv d'une manière spécifique et non pas en démarrant un serveur
et qui ensuite demande à un serveur le code à éxécuter
puis l'éxécute de le faisant passer pa la moulinette SystemJS en désactivant la transpilation

la première étape consiste donc à pouvoir include jsenv depuis un index.html
puis à pouvoir réclamer le code au serveur en utilisant une requête http

mais faire une requête http suppose d'avoir accès à rest, et rest à lui-même beaucoup de dépendance
et utilise babel donc pour le moment on va s'affranchir de ça
et faire une requête http à la main (xmlhttprequest)
mais bon c'est pas fou puisque il faudras alors réécrire ce bout de code pour nodejs
pour le moment on fait comme ça pas grave on améliore plus tard

une fois qu'on arrive à faire cette requête qui dit au serveur "hey je souhaite éxécuter du code"
il faut écrire le code serveur qui va alors renvoyer "console.log('it works')"
et le client pourra l'éxécuter

pour le test unitaire et le coverage il faudrais que le client renvoit au serveur comment s'est déroulé
l'éxécution du code afin qu ele serveur choisisse comment réagir au déroulement de l'éxécution du code
le client doit vraiment se contenter d'éxécuter le bout de code et renvoyer comment ça s'est passé
il ne doit pas chercher à afficher le coverage, le résultats des test, upload des rapports etc
ce travail sera fait par le serveur ou stocker pour être affiché plus tard par ce client ou un autre

le client envoit donc un POST une fois le fichier éxécuter pour dire comment ça s'est passé

run-report.json, or the content of the POST request
{
    url: 'http://localhost:80',
    date: Date.now(), // date when the execution occured (just before execution is actually runned)
    duration: performance.now() || process.hrtime() - performance.now() || process.hrtime()
    status: 'resolved', 'rejected',
    value: the exports for 'resolved', the throwed value for 'rejected'
}

// https://gist.github.com/paulirish/5438650
*/

import require from '@node/require';
import env from '@jsenv/env';

import rest from './src/rest/index.js';
import NodeServer from './src/server/index.js';

const babel = require('babel-core');

const myRest = rest.create('./');

myRest.use({
    match() {
        return true;
    },

    methods: {
        '*': function() {
            return {
                status: 200,
                body: '\
                    console.log("it works");\n\
                    export default "foo";\
                '
            };
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
    console.log(request.method, request.uri.toString());

    myRest.fetch(request).then(function(response) {
        const babelBody = rest.createBody();

        const buffers = [];
        const write = babelBody.write;
        const close = babelBody.close;
        babelBody.write = function(buffer) {
            buffers.push(buffer);
        };
        babelBody.close = function() {
            const code = buffers.join('');
            const options = env.System.babelOptions || {};
            options.modules = 'system';
            if (options.sourceMap === undefined) {
                options.sourceMap = 'inline';
            }
            // options.inputSourceMap = load.metadata.sourceMap;
            options.filename = 'http://localhost/file.js';
            options.code = true;
            options.ast = false;
            const transpiledCode = babel.transform(code, options).code;
            write.call(this, transpiledCode);
            return close.call(this);
        };

        response.body.pipeTo(babelBody);

        response.body = babelBody;
        return response;
    }).then(function(response) {
        const corsHeaders = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].join(', '),
            'access-control-allow-headers': ['x-requested-with', 'content-type', 'accept'].join(', '),
            'access-control-max-age': 1 // Seconds
        };
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
