import api from '@jsenv/api';
import {
    createRest,
    route,
    enableCors,
    createFileService,
    createJSResponse,
    // createHTMLResponse,
    syncWithServer
} from '@jsenv/rest';

import {
    createServer
} from '../server/index.js';

const rest = createRest();

function ensureHeader(request, headerName) {
    return request.headers.has(headerName);
}
function ensureSearchParam(request, paramName) {
    return request.url.searchParams.has(paramName);
}
function getInvalidProperties(request) {
    if (!ensureHeader(request, 'user-agent')) {
        return 400;
    }
    if (!ensureSearchParam(request, 'features')) {
        return 400;
    }
    return null;
}
route(
    rest,
    request => {
        return request.url.pathname === 'instructions/test';
    },
    {
        get: request => {
            var invalidProperties = getInvalidProperties(request);
            if (invalidProperties) {
                return invalidProperties;
            }

            var featureIds = request.url.searchParams.get('features').split(',');
            var userAgentHeader = request.headers.get('user-agent');
            var agent = api.parseAgent(userAgentHeader);
            return api.getTestInstructions(featureIds, agent).then(
                createJSResponse
            );
        },
        post: request => {
            var userAgentHeader = request.headers.get('user-agent');
            var agent = api.parseAgent(userAgentHeader);
            return request.json().then(function(records) {
                return api.setAllTest(records, agent);
            }).then(function() {
                return 200;
            });
        }
    }
);
route(
    rest,
    request => {
        return request.url.pathname === 'instructions/fix';
    },
    {
        get: request => {
            var invalidProperties = getInvalidProperties(request);
            if (invalidProperties) {
                return invalidProperties;
            }

            var featureIds = request.url.searchParams.get('features').split(',');
            var userAgentHeader = request.headers.get('user-agent');
            var agent = api.parseAgent(userAgentHeader);
            return api.getFixInstructions(featureIds, agent).then(
                createJSResponse
            );
        },
        post: request => {
            var userAgentHeader = request.headers.get('user-agent');
            var agent = api.parseAgent(userAgentHeader);
            return request.json().then(function(records) {
                return api.setAllFix(records, agent);
            }).then(function() {
                return 200;
            });
        }
    }
);
const fileService = createFileService({
    root: api.rootFolder + '/',
    index: './scan-browser.html'
});
route(
    rest,
    () => true,
    {
        get: fileService.get
    }
);
enableCors(rest);

const compatServer = createServer();
syncWithServer(rest, compatServer);
compatServer.onTransition = function(oldStatus, status) {
    if (status === 'opened') {
        console.log('compat server opened at', this.url.href);
    } else if (status === 'closed') {
        console.log('compat server closed');
    }
};

export default compatServer;
