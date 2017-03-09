import require from '@node/require';

import env from '@jsenv/env';
import compose from '@jsenv/compose';
import System from '@jsenv/system';

/*
provide beforeExit.on/off to register callback to run before code exists
thoose callback are runned in parallel when user leaves the page (browser) or terminal (node)
inside nodejs process.exit is delayed until all promisified callback have resolved

ceci pourrait devenir une feature au lieu d'être mit ici mais j'avoue que je sais pas encore comment
je vais gérer ce genre de chose, c'est différent d'une feature qu'on veut polyfill ou transpile
c'est bien une feature mais pas standard
*/
env.provide('beforeExit', (function() {
    const exit = env.platformPolymorph({
        browser() {
            // in the browser this may not be called
            // because you cannot prevent user from leaving your page
        },
        node() {
            process.exit();
        }
    });
    const install = env.platformPolymorph({
        browser(callback) {
            const previous = window.onbeforeunload;
            window.onbeforeunload = callback;
            return function() {
                window.onbeforeunload = previous;
            };
        },
        node(callback) {
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
                process.on('SIGINT', callback);
                return function() {
                    rl.removeListener('SIGINT', forceEmit);
                    process.removeListener('SIGINT', callback);
                };
            }
            process.on('SIGINT', callback);
            return function() {
                process.removeListener('SIGINT', callback);
            };
        }
    });
    const listeners = [];
    let uninstaller = null;
    let installed = false;

    const beforeExit = {
        emit() {
            return Promise.race(listeners.map(function(fn) {
                return Promise.resolve(fn());
            })).then(() => {
                beforeExit.uninstall();
                exit();
            });
        },
        install: function() {
            if (installed === false) {
                uninstaller = install(beforeExit.emit);
                installed = true;
            }
        },
        uninstall: function() {
            if (installed === true) {
                uninstaller();
                installed = false;
                uninstaller = undefined;
            }
        },
        add(fn) {
            if (listeners.length === 0) {
                beforeExit.install();
            }
            listeners.push(fn);
        },
        remove(fn) {
            var index = listeners.indexOf(fn);
            if (index > -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0) {
                beforeExit.uninstall();
            }
        }
    };

    return beforeExit;
})());

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
        const beforeExitListener = () => {
            return this.close();
        };

        this.beforeExitListener = beforeExitListener;
        env.beforeExit.add(beforeExitListener);

        return new Promise(resolve => {
            this.transit('opening');
            resolve(createServer({
                secure: isHttps
            }));
        }).then(server => {
            const connections = new Set();

            server.on('connection', connection => {
                connection.on('close', () => {
                    connections.delete(connection);
                });
                connections.add(connection);
            });
            server.on('request', (request, response) => {
                this.requestHandler(request, response);
            });

            this.url = url;
            this.server = server;
            this.connections = connections;

            return openServer(server, port, url.hostname);
        }).then(() => {
            this.transit('opened');
            return this;
        });
    },

    close() {
        return new Promise(resolve => {
            this.transit('closing');
            for (var connection of this.connections) {
                connection.destroy(); // can it throw ?
            }
            resolve();
        }).then(() => {
            const server = this.server;
            if (server._handle) {
                return closeServer(server);
            }
        }).then(() => {
            this.transit('closed');
            env.beforeExit.remove(this.beforeExitListener);
            return this;
        });
    }
});

export default NodeServer;
