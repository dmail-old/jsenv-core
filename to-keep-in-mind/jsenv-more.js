build(function coreModules() {
    function createModuleExportingDefault(defaultExportsValue) {
        /* eslint-disable quote-props */
        return this.System.newModule({
            "default": defaultExportsValue
        });
        /* eslint-enable quote-props */
    }

    function registerCoreModule(moduleName, defaultExport) {
        this.System.set(moduleName, this.createModuleExportingDefault(defaultExport));
    }

    return {
        createModuleExportingDefault: createModuleExportingDefault,
        registerCoreModule: registerCoreModule
    };
});

build(function createSystem() {
    return {
        import: function(a, b) {
            return this.System.import(a, b);
        },

        importDefault: function(a, b) {
            return this.import(a, b).then(function(exports) {
                return exports.default;
            });
        },

        createSystem: function() {
            // dont touch the global System, use a local one
            var System = Object.create(this.SystemPrototype);
            System.constructor();

            System.transpiler = 'babel';
            System.trace = true;
            System.babelOptions = {};
            System.paths.babel = this.dirname + '/node_modules/babel-core/browser.js';
            // .json auto handled as json
            System.meta['*.json'] = {format: 'json'};

            System.config({
                map: {
                    'source-map': this.dirname + '/node_modules/source-map',
                    immutable: this.dirname + '/node_modules/immutable',
                    modules: this.dirname + '/node_modules',
                    '@jsenv/compose': this.dirname + '/node_modules/jsenv-compose'
                },
                packages: {
                    immutable: {
                        main: 'dist/immutable.js',
                        format: 'cjs',
                        defaultExtension: 'js'
                    },
                    "source-map": {
                        main: 'source-map.js',
                        format: 'cjs',
                        defaultExtension: 'js'
                    },
                    '@jsenv/compose': {
                        main: 'index.js',
                        format: 'es6'
                    }
                }
            });

            var oldImport = System.import;
            System.import = function() {
                return oldImport.apply(this, arguments).catch(function(error) {
                    if (error && error instanceof Error) {
                        var originalError = error;
                        while ('originalErr' in originalError) {
                            originalError = originalError.originalErr;
                        }
                        return Promise.reject(originalError);
                    }
                    return error;
                });
            };

            return System;
        },

        configSystem: function() {
            if (this.isNode()) {
                // @node/fs etc available thanks to https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L1695
                this.registerCoreModule('@node/require', require);
            }

            var jsenv = this;
            var prefixModule = function(name) {
                var prefix = jsenv.modulePrefix;
                var prefixedName;
                if (prefix) {
                    prefixedName = prefix + '/' + name;
                } else {
                    prefixedName = name;
                }

                return prefixedName;
            };

            this.registerCoreModule(prefixModule(this.rootModuleName), jsenv);
            this.registerCoreModule(prefixModule(this.moduleName), this);

            [
                'action',
                'fetch-as-text',
                'iterable',
                'lazy-module',
                'options',
                'thenable',
                'rest',
                'server',
                'timeout',
                'url'
            ].forEach(function(libName) {
                var libPath = this.dirname + '/src/' + libName + '/index.js';
                this.System.paths[prefixModule(libName)] = libPath;
            }, this);
        }
    };
});

// quand on crée un env on faisait ça

this.System = this.createSystem();

// keep a global System object because many people will use global.System
// but warn about the fact that doing this is discouraged because
// it bind your code to global.System which prevent your code from beign runned multiple times
// in the same process with different env
if (Object.defineProperty) {
    var accessed = false;
    var self = this;

    Object.defineProperty(this.global, 'System', {
        configurable: true,
        get: function() {
            if (accessed === false) {
                // env.warn(
                //     'global.System used at ',
                //     new Error().stack.split('\n')[1],
                //     ', use env.System instead'
                // );
                accessed = true;
            }
            return self.System;
        }
    });
} else {
    this.global.System = this.System;
}

this.configSystem();

build(function create() {
            return {
                lastId: 0,

                constructor: function(options) {
                    jsenv.lastId++;
                    this.id = '<env #' + this.lastId + '>';

                    this.debug('creating', this.id);

                    var customOptions = {};
                    this.assign(customOptions, this.options);
                    if (options) {
                        this.assign(customOptions, options);
                    }

                    this.options = customOptions;
                },

                create: function(options) {
                    if (this.globalAssignment.assigned) {
                        // do not remove immediatly to let a chance to create multiple env if needed
                        setImmediate(function() {
                            this.globalAssignment.cancel();
                        }.bind(this));
                    }

                    var env = Object.create(jsenv);

                    env.constructor(options);

                    return env;
                },

                setup: function(env) {
                    return jsenv.importDefault(this.dirname + '/setup.js').then(function(setup) {
                        return setup(env);
                    });
                },

                generate: function(options) {
                    var env = jsenv.create(options);

                    return jsenv.setup(env).then(function() {
                        return env;
                    });
                }
            };
        });

function listFiles(jsenv) {
        // comment faire en sorte que le script principal (celui lançant le serveur)
        // bénéficie lui assi du polyfill dynamique ?
        // il faudrais qu'il génére son propré profil
        // puisqu'il généère le code correpsondant avant de l'éxécuter
        // pour cela il doit donc utiliser core-js-builder
        // y append certain polyfill comme url, url-search-params
        // enfin éxécuter tout ce code (plus tard on mettras tout ça dans un fichier)
        // pour éviter de reconstruire tout
        // enfin on chargeras SystemJS
        // la première chose à faire est donc de créer la fonction qui renvoit la liste des choses requises
        // en fonction de l'implementation
        // il faut aussi voir si on peut pas utiliser babel6 ou un regenerator runtime qui marche
        // pour regenerator runtime c'est si on veut utiliser yield
        // et on pourras alors l'ajouter au polyfill en récupérant le bon package
        // allez c'est parti

        // bon j'ai besoin de détecter ce dont y'a besoin
        // pour le moment partons du principe que c'est tout
        // dont on va utiliser
        // mais ça limite on pourrais le mettre dans le code spécifique au serveur nodejs
        // ensuite le client lui va demander au serveur le fichier en précisant tout ce dont il a besoin
        // le serveur lui fait un build custom et lui retourne

        var files = [];

        function add(name, path) {
            files.push({
                name: name,
                url: jsenv.dirname + '/' + path
            });
        }

        if (jsenv.isBrowser()) {
            add('systemjs', 'node_modules/systemjs/dist/system.js');
        } else {
            add('systemjs', 'node_modules/systemjs/index.js');
        }

        return files;
    }

    function includeFiles(jsenv, files, callback) {
        function includeAllBrowser() {
            var i = 0;
            var j = files.length;
            var file;
            var loadCount = 0;
            var scriptLoadedMethodName = 'includeLoaded';

            var scriptLoadedGlobalMethodAssignment = jsenv.createCancellableAssignment(
                jsenv.global,
                scriptLoadedMethodName
            );
            scriptLoadedGlobalMethodAssignment.assign(function() {
                loadCount++;
                if (loadCount === j) {
                    scriptLoadedGlobalMethodAssignment.cancel();
                    callback();
                }
            });

            for (;i < j; i++) {
                file = files[i];
                var scriptSource;

                scriptSource = '<';
                scriptSource += 'script type="text/javascript" onload="' + scriptLoadedMethodName + '()" src="';
                scriptSource += file.url;
                scriptSource += '">';
                scriptSource += '<';
                scriptSource += '/script>';

                document.write(scriptSource);
            }
        }

        function includeAllNode() {
            var i = 0;
            var j = files.length;
            var file;
            var url;
            for (;i < j; i++) {
                file = files[i];
                url = file.url;
                if (url.indexOf('file:///') === 0) {
                    url = url.slice('file:///'.length);
                }

                jsenv.debug('include', file.name);
                require(url);
            }
            callback();
        }

        if (jsenv.isBrowser()) {
            includeAllBrowser(files);
        } else {
            includeAllNode(files);
        }
    }

    var files = listFiles(jsenv);
    includeFiles(jsenv, files, function() {
        jsenv.SystemPrototype = jsenv.global.System;
        delete jsenv.global.System; // remove System from the global scope
        jsenv.constructor();
    });

build(function exceptionHandler() {
            // wait 1000ms before throwing any error
            // jsenv.exceptionHandler.add(function(e){
            //     return new Promise(function(res, rej){ setTimeout(function(){ rej(e); }, 1000); });
            // });
            // // do not throw error with code itsok
            // jsenv.exceptionHandler.add(function(e){
            //     return e && e instanceof Error && e.code === 'itsok' ? undefined : Promise.reject(e);
            // });

            // exceptionHandler must become global
            // to handle the exception of a specific env, just catch env.generate().catch()

            function Exception(value, origin) {
                if (value instanceof Exception) {
                    return value;
                }
                this.value = value;
                this.origin = origin;
            }

            Exception.prototype = {
                constructor: Exception,

                isRejection: function() {
                    return this.hasOwnProperty('origin') && typeof this.origin.then === 'function';
                },

                isComingFrom: function(origin) {
                    return this.origin === origin;
                }
            };

            function ExceptionHandler() {
                this.handlers = [];
                this.handledException = undefined;
                this.pendingExceptions = [];
            }

            ExceptionHandler.prototype = {
                constructor: ExceptionHandler,

                add: function(handler) {
                    this.handlers.push(handler);
                },

                throw: function(value) {
                    throw value;
                },

                createException: function(value, origin) {
                    var exception = new Exception(value, origin);
                    return exception;
                },

                attemptToRecover: function(exception) {
                    var index = 0;
                    var handlers = this.handlers.slice(); // any handler added during recover is ignored thanks to this line
                    var self = this;
                    var nextHandler = function() {
                        var promise;

                        if (index < handlers.length) {
                            var handler = handlers[index];
                            index++;

                            promise = new Promise(function(resolve) {
                                resolve(handler.call(self, exception.value, exception));
                            }).then(
                                function() {
                                    return true;
                                },
                                function(rejectionValue) {
                                    if (rejectionValue === exception.value) {
                                        return nextHandler();
                                    }
                                    // an error occured during exception handling, log it and consider exception as not recovered
                                    console.error(
                                        'the following occurred during exception handling : ',
                                        rejectionValue
                                    );
                                    return false;
                                }
                            );
                        } else {
                            promise = Promise.resolve(false);
                        }

                        return promise;
                    };

                    var manualRecoverStatusPromise = new Promise(function(resolve, reject) {
                        this.recoverAttempt = {
                            resolve: resolve,
                            reject: reject
                        };
                    }.bind(this));

                    var handlerRecoverStatusPromise = nextHandler();

                    return Promise.race([
                        handlerRecoverStatusPromise,
                        manualRecoverStatusPromise
                    ]);
                },

                handleException: function(exception) {
                    // exception.handler = this;
                    if (this.handledException) {
                        this.pendingExceptions.push(exception);
                    } else {
                        this.handledException = exception;
                        this.attemptToRecover(exception).then(function(recovered) {
                            this.pendingExceptions.splice(this.pendingExceptions.indexOf(exception), 1);

                            if (recovered) {
                                this.handledException = undefined;
                                if (this.pendingExceptions.length) {
                                    var pendingException = this.pendingExceptions.shift();
                                    this.handleException(pendingException); // now try to recover this one
                                }
                            } else {
                                // put in a timeout to prevent promise from catching this exception
                                setTimeout(function() {
                                    // disableHooks to prevent hook from catching this error
                                    // because the following creates an infinite loop (and is what we're doing)
                                    // process.on('uncaughtException', function() {
                                    //     setTimeout(function() {
                                    //         throw 'yo';
                                    //     });
                                    // });
                                    // we have to ignore exception thrown while we are throwing, we could detect if the exception differs
                                    // which can happens if when doing throw new Error(); an other error occurs
                                    // -> may happen for instance if accessing error.stack throw an other error
                                    this.disable();
                                    // there is still on uncaughtException on global env, which will catch the exception and because of this will
                                    // retry to recover the exception, it's not a problem except that only parent should be allowed to recover the exception
                                    // child must not have a chance to recatch the same exception again, for now just disable the hooks
                                    this.throw(exception.value);
                                    // enabledHooks in case throwing error did not terminate js execution
                                    // in the browser or if external code is listening for process.on('uncaughException');
                                    this.enable();
                                }.bind(this), 0);
                            }
                        }.bind(this));
                    }

                    return exception;
                },

                handleError: function(error) {
                    var exception;

                    exception = this.createException(error);

                    return this.handleException(exception);
                },

                handleRejection: function(rejectedValue, promise) {
                    if (rejectedValue instanceof Exception) {
                        return rejectedValue;
                    }

                    var exception;

                    exception = this.createException(rejectedValue, promise);

                    return this.handleException(exception);
                },

                recover: function(exception) {
                    // if exception is being recovered, cancel it and consider as recovered
                    // if the exception was pending to be recovered just remove it from the list

                    if (this.handledException === exception) {
                        this.recoverAttempt.resolve(true);
                    } else if (this.pendingExceptions.includes(exception)) {
                        this.pendingExceptions.splice(this.pendingExceptions.indexOf(exception), 1);
                    }
                },

                markPromiseAsHandled: function(promise) {
                    // à refaire puisque pas géé pour le moment
                    var handledException = this.handledException;

                    if (handledException) {
                        if (handledException.isComingFromPromise(promise)) {
                            this.recover(handledException);
                        } else {
                            var pendings = this.pendingExceptions;
                            var i = pendings.length;
                            while (i--) {
                                var exception = pendings[i];
                                if (exception.isComingFromPromise(promise)) {
                                    this.recover(exception);
                                    break;
                                }
                            }
                        }
                    }
                }
            };

            var exceptionHandler = new ExceptionHandler();

            function catchError(error) {
                return exceptionHandler.handleError(error);
            }

            function unhandledRejection(value, promise) {
                return exceptionHandler.handleRejection(value, promise);
            }

            function rejectionHandled(promise) {
                return exceptionHandler.markPromiseAsHandled(promise);
            }

            var enableHooks;
            var disableHooks;
            if (jsenv.isBrowser()) {
                enableHooks = function() {
                    window.onunhandledrejection = function(e) {
                        unhandledRejection(e.reason, e.promise);
                    };
                    window.onrejectionhandled = function(e) {
                        rejectionHandled(e.promise);
                    };
                    window.onerror = function(errorMsg, url, lineNumber, column, error) {
                        catchError(error);
                    };
                };
                disableHooks = function() {
                    window.onunhandledrejection = undefined;
                    window.onrejectionhandled = undefined;
                    window.onerror = undefined;
                };
            } else if (jsenv.isNode()) {
                enableHooks = function() {
                    process.on('unhandledRejection', unhandledRejection);
                    process.on('rejectionHandled', rejectionHandled);
                    process.on('uncaughtException', catchError);
                };
                disableHooks = function() {
                    process.removeListener('unhandledRejection', unhandledRejection);
                    process.removeListener('rejectionHandled', rejectionHandled);
                    process.removeListener('uncaughtException', catchError);
                };
            }

            exceptionHandler.enable = function() {
                enableHooks();
            };

            exceptionHandler.disable = function() {
                disableHooks();
            };

            // exceptionHandler.enable();
            exceptionHandler.jsenv = jsenv;

            return {
                exceptionHandler: exceptionHandler
            };
        });
