/* eslint-env browser, node */
/* global URL */

import env from '@jsenv/env';
import compose from '@jsenv/compose';
import require from '@node/require';

/*
provide beforeExit.on/off to register callback to run before code exists
thoose callback are runned in parallel when user leaves the page (browser) or terminal (node)
inside nodejs process.exit is delayed until all promisified callback have resolved
*/
env.provide(function beforeExit() {
    var listeners = [];
    var installBeforeExit;
    var uninstallBeforeExit;
    var performExit;
    var beforeExit = {
        emit() {
            Promise.race(listeners.map(function(fn) {
                return Promise.resolve(fn());
            })).then(function() {
                if (uninstallBeforeExit) {
                    uninstallBeforeExit();
                    uninstallBeforeExit = undefined;
                }
                performExit();
            });
        },

        add(fn) {
            if (listeners.length === 0) {
                uninstallBeforeExit = installBeforeExit();
            }
            listeners.push(fn);
        },

        remove(fn) {
            var index = listeners.indexOf(fn);
            if (index > -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0 && uninstallBeforeExit) {
                uninstallBeforeExit();
                uninstallBeforeExit = undefined;
            }
        }
    };

    if (env.isBrowser()) {
        installBeforeExit = function() {
            window.onbeforeunload = beforeExit.emit;

            return function() {
                window.onbeforeunload = undefined;
            };
        };
        performExit = function() {
            // in the browser this may not be called
            // because you cannot prevent user from leaving your page
        };
    } else if (env.isNode()) {
        installBeforeExit = function() {
            function emit() {
                beforeExit.emit();
            }

            var uninstallBeforeExit;

            if (env.isWindows()) {
                // http://stackoverflow.com/questions/10021373/what-is-the-windows-equivalent-of-process-onsigint-in-node-js
                var rl = require("readline").createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                var forceEmit = function() {
                    process.emit('SIGINT');
                };

                rl.on('SIGINT', forceEmit);
                process.on('SIGINT', emit);
                uninstallBeforeExit = function() {
                    rl.removeListener('SIGINT', forceEmit);
                    process.removeListener('SIGINT', emit);
                };
            } else {
                process.on('SIGINT', emit);
                uninstallBeforeExit = function() {
                    process.removeListener('SIGINT', emit);
                };
            }

            return uninstallBeforeExit;
        };
        performExit = function() {
            process.exit();
        };
    }

    return {
        beforeExit: beforeExit
    };
});

const NodeServer = compose({
    constructor(requestHandler) {
        this.requestHandler = requestHandler;
        this.status = 'closed';
    },

    transit(status) {
        // quelque chose de mieux genre qui force un passage
        // de closed -> opening -> opened -> closing -> closed
        // avec un moyen d'écouter tout/une partie des transitions
        // finite state machine ?
        // https://github.com/ianmcgregor/state-machine-js

        const currentStatus = this.status;
        if (status === 'opening') {
            if (currentStatus !== 'closed') {
                throw new Error('server cannot transit from "' + currentStatus + '" to ' + status);
            }
        } else if (status === 'closing') {
            if (currentStatus !== 'opened') {
                throw new Error('server cannot transit from "' + currentStatus + '" to ' + status);
            }
        }

        this.status = status;
        this.onTransition(currentStatus, status);
    },

    onTransition() {},

    open(location) {
        const url = new URL(location);
        const isHttps = url.protocol === 'https:';
        const port = url.port || (isHttps ? 443 : 80);

        env.beforeExit.add(function() {
            return this.close();
        }.bind(this));

        return new Promise(function(resolve) {
            this.transit('opening');
            resolve(createServer({
                secure: isHttps
            }));
        }.bind(this)).then(function(server) {
            const connections = new Set();
            const requestHandler = this.requestHandler;

            server.on('connection', function(connection) {
                connection.on('close', function() {
                    connections.delete(connection);
                });

                connections.add(connection);
            });
            server.on('request', function(request, response) {
                requestHandler(request, response);
            });

            this.url = url;
            this.server = server;
            this.connections = connections;

            return openServer(server, port, url.hostname);
        }.bind(this)).then(function() {
            this.transit('opened');
        }.bind(this));
    },

    close() {
        return new Promise(function(resolve) {
            this.transit('closing');
            for (var connection of this.connections) {
                connection.destroy(); // can it throw ?
            }
            resolve();
        }.bind(this)).then(function() {
            const server = this.server;
            if (server._handle) {
                return closeServer(server);
            }
        }.bind(this)).then(function() {
            this.transit('closed');
        }.bind(this));
    }
});

function createServer(options) {
    const nodeModuleName = options.secure ? 'https' : 'http';

    return System.import('@node/' + nodeModuleName).then(function(nodeModule) {
        return nodeModule.createServer();
    });
}

function openServer(server, port, hostname) {
    return new Promise(function(resolve, reject) {
        server.listen(port, hostname, createExecutorCallback(resolve, reject));
    });
}

function createExecutorCallback(resolve, reject) {
    return function(error) {
        if (error) {
            reject(error);
        } else {
            resolve();
        }
    };
}

function closeServer(server) {
    return new Promise(function(resolve, reject) {
        server.close(createExecutorCallback(resolve, reject));
    });
}

export default NodeServer;
