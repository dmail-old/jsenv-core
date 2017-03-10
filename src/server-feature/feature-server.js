/*

lorsque le client import @jsenv/url il faut lui donner ce qu'on a configuré
je pense qu'il faut mettre config-system dans un fichier qu'on éxécute coté client ET coté serveur
(et oui surtout qu'on y enregistre l'objet jsenv qui ne serais pas dispo dans le client)

nodejs fera sa tambouille pour y ajouter des trucs custom (api, require noattement)

*/

import {parse as parseUrl} from '@jsenv/url';
import api from '@jsenv/api';
import {
    createRest,
    route,
    enableCors,
    createFileService,
    // createHTMLResponse,
    syncWithServer
} from '@jsenv/rest';

import {
    createServer
} from '../server/index.js';

const rest = createRest();
enableCors(rest);

const defaultFeatureIds = [
    'string/prototype/at',
    'system'
];
function getRequestFeatures(request) {
    const searchParams = request.url.searchParams;
    let featureIds;
    if (searchParams.has('features')) {
        featureIds = searchParams.get('features').split(',');
    } else {
        featureIds = defaultFeatureIds;
    }
    return featureIds;
}
function getRequestAgent(request) {
    const userAgentHeader = request.headers.get('user-agent');
    const agent = api.parseAgent(userAgentHeader);
    return agent;
}

// polyfill
route(
    rest,
    request => {
        return request.url.pathname === 'polyfill.js';
    },
    {
        get: request => {
            const featureIds = getRequestFeatures(request);
            const agent = getRequestAgent(request);
            return api.polyfill(featureIds, agent).then(function(polyfillLocation) {
                return {
                    status: 302, // le client ne reçoit jamais ça
                    // parce qu'en fait les redirections sont traités en interne
                    // faudrais ptet désactivé ça
                    headers: {
                        'location': polyfillLocation
                    }
                };
            });
        }
    }
);
// transpile
route(
    rest,
    request => {
        return request.url.searchParams.get('transpile') === '1';
    },
    {
        get: request => {
            const featureIds = getRequestFeatures(request);
            const agent = getRequestAgent(request);
            const filename = parseUrl(api.rootFolder + '/').resolve(request.url.pathname);

            return api.transpile(filename, featureIds, agent).then(
                transpiledLocation => {
                    return {
                        status: 302,
                        headers: {
                            'location': transpiledLocation
                        }
                    };
                },
                error => {
                    if (error && error.code === 'ENOENT') {
                        return {
                            status: 400
                        };
                    }
                    return Promise.reject(error);
                }
            );
        }
    }
);
const fileService = createFileService({
    root: api.rootFolder + '/',
    index: './src/server-feature/client.html'
});
route(
    rest,
    () => true,
    {
        get: fileService.get
    }
);

const compatServer = createServer();
syncWithServer(rest, compatServer);
compatServer.onTransition = function(oldStatus, status) {
    if (status === 'opened') {
        console.log('jsenv server opened at', this.url.href);
    } else if (status === 'closed') {
        console.log('jsenv server closed');
    }
};

export default compatServer;
