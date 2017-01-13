/* eslint-env browser, node */
/* after including this file you can create your own env, (most time only one is enough) */

/*

à faire:

enlever certain trucs comme les modules qu isont externalisées dans configSystem

externaliser sourcemap
externaliser remap-error-stack
externaliser module-test
externaliser module-cover

maintenant qu'on a externalisé des trucs l'idée c'est de faire un truc à la babel
qui en gros dit: je souhaite me servir de ces fonctionnalités là: module-test, module-source
sauf que pour pouvoir faire ça je sais pas, donc s'inspirer de babel

en gros babel utilise .babelrc pour dire utilise ce plugin (qui doit alors être dans les node_modules je présume)
ou utilise une options de la méthode transform, en tous cas
c'est un module dans le node_modules

je dis pourquoi pas

*/

(function() {
    function buildJSEnv(jsenv) {
        function assign(object, properties) {
            for (var key in properties) { // eslint-disable-line
                object[key] = properties[key];
            }
        }

        function build(data) {
            var properties;

            if (typeof data === 'function') {
                // console.log('build', data.name);
                properties = data.call(jsenv);
            } else {
                properties = data;
            }

            if (properties) {
                assign(jsenv, properties);
            }
        }

        jsenv.assign = assign;
        jsenv.build = build;
        jsenv.options = {};

        build(function version() {
            function parseVersionPart(versionPart) {
                var parsed;
                if (versionPart === '*') {
                    parsed = versionPart;
                } else if (isNaN(versionPart)) {
                    throw new Error('version part must be a number (not ' + versionPart + ')');
                } else {
                    parsed = parseInt(versionPart);
                }

                return parsed;
            }

            function compareVersionPart(a, b) {
                if (a === '*') {
                    return true;
                }
                if (b === '*') {
                    return true;
                }
                return a === b;
            }

            function Version(firstArg) {
                var versionName = String(firstArg);
                var major;
                var minor;
                var patch;

                if (versionName === '*') {
                    major =
                    minor =
                    patch = '*';
                } else if (versionName.indexOf('.') === -1) {
                    major = parseVersionPart(versionName);
                    minor =
                    patch = 0;
                } else {
                    var versionParts = versionName.split('.');
                    var versionPartCount = versionParts.length;

                    if (versionPartCount === 2) {
                        major = parseVersionPart(versionParts[0]);
                        minor = parseVersionPart(versionParts[1]);
                        patch = 0;
                    } else if (versionPartCount === 3) {
                        major = parseVersionPart(versionParts[0]);
                        minor = parseVersionPart(versionParts[1]);
                        patch = parseVersionPart(versionParts[2]);
                    } else {
                        throw new Error('version must not have more than two "."');
                    }
                }

                this.major = major;
                this.minor = minor;
                this.patch = patch;
            }

            Version.prototype = {
                match: function(firstArg) {
                    var version;
                    if (typeof firstArg === 'string') {
                        version = new Version(firstArg);
                    } else if (Version.isPrototypeOf(firstArg)) {
                        version = firstArg;
                    } else {
                        throw new Error('version.match expect a string or a version object');
                    }

                    return (
                        compareVersionPart(this.patch, version.patch) &&
                        compareVersionPart(this.minor, version.minor) &&
                        compareVersionPart(this.major, version.major)
                    );
                },

                toString: function() {
                    return this.major + '.' + this.minor + '.' + this.patch;
                }
            };

            return {
                createVersion: function(string) {
                    return new Version(string);
                }
            };
        });

        build(function platform() {
            // platform is what runs the agent : windows, linux, mac, ..
            var platform = {
                name: 'unknown',
                version: '',

                setName: function(name) {
                    this.name = name.toLowerCase();
                },

                setVersion: function(version) {
                    this.version = jsenv.createVersion(version);
                },

                match: function(platform) {
                    if ('name' in platform && this.name !== platform.name) {
                        return false;
                    }
                    if ('version' in platform && this.version.match(platform.version) === false) {
                        return false;
                    }

                    return true;
                }
            };

            return {
                platform: platform
            };
        });

        build(function agent() {
            // agent is what runs JavaScript : nodejs, iosjs, firefox, ...
            var type;

            var agent = {
                type: 'unknown',
                name: 'unknown',
                version: 'unknown',

                setName: function(name) {
                    this.name = name.toLowerCase();
                },

                setVersion: function(version) {
                    this.version = jsenv.createVersion(version);
                },

                match: function(agent) {
                    if ('type' in agent && this.type !== agent.type) {
                        return false;
                    }
                    if ('name' in agent && this.name !== agent.name) {
                        return false;
                    }
                    if ('version' in agent && this.version.match(agent.version) === false) {
                        return false;
                    }

                    return true;
                }
            };

            if (typeof window === 'object') {
                if (
                    typeof window.WorkerGlobalScope === 'object' &&
                    typeof navigator === 'object' &&
                    typeof navigator instanceof window.WorkerNavigator
                ) {
                    type = 'webworker';
                } else {
                    type = 'browser';

                    var ua = navigator.userAgent.toLowerCase();
                    var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+(?:\.\d+)?)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
                    var UA = ua.match(regex) || [null, 'unknown', 0];
                    var name = UA[1] === 'version' ? UA[3] : UA[1];
                    var version;

                    // version
                    if (UA[1] === 'ie' && document.documentMode) {
                        version = document.documentMode;
                    } else if (UA[1] === 'opera' && UA[4]) {
                        version = UA[4];
                    } else {
                        version = UA[2];
                    }

                    agent.setName(name);
                    agent.setVersion(version);

                    this.platform.setName(window.navigator.platform);
                }
            } else if (typeof process === 'object' && {}.toString.call(process) === "[object process]") {
                // Don't get fooled by e.g. browserify environments.
                type = 'node';
                agent.setName('node');
                agent.setVersion(process.version.slice(1));

                var os = require('os');

                // https://nodejs.org/api/process.html#process_process_platform
                // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
                this.platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
                this.platform.setVersion(os.release());
            } else {
                type = 'unknown';
            }

            agent.type = type;

            return {
                agent: agent,

                isWindows: function() {
                    return this.platform.name === 'windows';
                },

                isBrowser: function() {
                    return this.agent.type === 'browser';
                },

                isNode: function() {
                    return this.agent.type === 'node';
                }
            };
        });

        build(function globalAccessor() {
            var globalValue;

            if (this.isBrowser()) {
                globalValue = window;
            } else if (this.isNode()) {
                globalValue = global;
            }

            return {
                global: globalValue
            };
        });

        build(function baseAndInternalURL() {
            var baseURL;
            var internalURL;
            var cleanPath;
            var parentPath;

            parentPath = function(path) {
                return path.slice(0, path.lastIndexOf('/'));
            };

            if (this.isBrowser()) {
                cleanPath = function(path) {
                    return path;
                };

                baseURL = (function() {
                    var href = window.location.href.split('#')[0].split('?')[0];
                    var base = href.slice(0, href.lastIndexOf('/') + 1);

                    return base;
                })();
                internalURL = document.scripts[document.scripts.length - 1].src;
            } else {
                var mustReplaceBackSlashBySlash = process.platform.match(/^win/);
                var replaceBackSlashBySlash = function(path) {
                    return path.replace(/\\/g, '/');
                };

                cleanPath = function(path) {
                    if (mustReplaceBackSlashBySlash) {
                        path = replaceBackSlashBySlash(String(path));
                    }
                    if (/^[A-Za-z]:\/.*?$/.test(path)) {
                        path = 'file:///' + path;
                    }
                    return path;
                };

                baseURL = (function() {
                    var cwd = process.cwd();
                    var baseURL = cleanPath(cwd);
                    if (baseURL[baseURL.length - 1] !== '/') {
                        baseURL += '/';
                    }
                    return baseURL;
                })();
                internalURL = cleanPath(__filename);
            }

            return {
                baseURL: baseURL, // from where am I running system-run
                internalURL: internalURL, // where is this file
                dirname: parentPath(internalURL), // dirname of this file
                cleanPath: cleanPath,
                parentPath: parentPath
            };
        });

        build(function logger() {
            return {
                info: function() {
                    if (this.options.logLevel === 'info') {
                        console.info.apply(console, arguments);
                    }
                },

                warn: function() {
                    console.warn.apply(console, arguments);
                },

                debug: function() {
                    if (this.options.logLevel === 'debug') {
                        console.log.apply(console, arguments);
                    }
                }
            };
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

            exceptionHandler.enable();
            exceptionHandler.jsenv = jsenv;

            return {
                exceptionHandler: exceptionHandler
            };
        });

        build(function cancellableAssignment() {
            return {
                createCancellableAssignment: function(object, name) {
                    var assignmentHandler = {
                        assigned: false,
                        owner: object,
                        name: name,

                        save: function() {
                            if (this.name in this.owner) {
                                this.hasPreviousValue = true;
                                this.previousValue = this.owner[this.name];
                            } else {
                                this.hasPreviousValue = false;
                                this.previousValue = undefined;
                            }
                        },

                        assign: function(value) {
                            if (this.assigned) {
                                throw new Error('value already assigned');
                            }

                            this.owner[this.name] = value;
                            this.assigned = true;
                        },

                        cancel: function() {
                            if (this.assigned === false) {
                                throw new Error('cancel() must be called on assigned value');
                            }

                            if (this.hasPreviousValue) {
                                this.owner[this.name] = this.previousValue;
                            } else {
                                delete this.owner[this.name];
                            }

                            // this.previousValue = undefined;
                            // this.hasPreviousValue = false;
                            this.assigned = false;
                        }
                    };

                    assignmentHandler.save();

                    return assignmentHandler;
                }
            };
        });

        build(function caseTransform() {
            return {
                hyphenToCamel: function(string) {
                    return string.replace(/-([a-z])/g, function(g) {
                        return g[1].toUpperCase();
                    });
                },

                camelToHypen: function(string) {
                    return string.replace(/([a-z][A-Z])/g, function(g) {
                        return g[0] + '-' + g[1].toLowerCase();
                    });
                }
            };
        });

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
                    this.System = this.createSystem();

                    // keep a global System object because many people will use global.System
                    // but warn about the fact that doing this is discouraged because
                    // it bind your code to global.System which prevent your code from beign runned multiple times
                    // in the same process with different env
                    if (jsenv.implementation.support('object-get-own-property-descriptor')) {
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

        // DEPRECATED (not used anymore)
        // build(function include() {
        //     var importMethod;

        //     if (env.isBrowser()) {
        //         importMethod = function(url) {
        //             var script = document.createElement('script');
        //             var promise = new Promise(function(resolve, reject) {
        //                 script.onload = resolve;
        //                 script.onerror = reject;
        //             });

        //             script.src = url;
        //             script.type = 'text/javascript';
        //             document.head.appendChild(script);

        //             return promise;
        //         };
        //     } else {
        //         importMethod = function(url) {
        //             if (url.indexOf('file:///') === 0) {
        //                 url = url.slice('file:///'.length);
        //             }

        //             return new Promise(function(resolve) {
        //                 resolve(require(url));
        //             });
        //         };
        //     }

        //     return {
        //         import: importMethod
        //     };
        // });

        return jsenv;
    }

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

        var implementation = jsenv.implementation;

        if (implementation.support('set-immediate') === false) {
            add('set-immediate-polyfill', 'src/polyfill/set-immediate/index.js');
        }
        if (implementation.support('promise') === false) {
            add('promise-polyfill', 'src/polyfill/promise/index.js');
        }
        if (implementation.support('url') === false) {
            add('url-polyfill', 'src/polyfill/url/index.js');
        }
        if (implementation.support('url-search-params') === false) {
            add('url-search-params-polyfill', 'src/polyfill/url-search-params/index.js');
        }

        if (jsenv.isBrowser()) {
            add('systemjs', 'node_modules/systemjs/dist/system.js');
        } else {
            add('systemjs', 'node_modules/systemjs/index.js');
        }

        if (implementation.support('es6') === false) {
            if (jsenv.isBrowser()) {
                add('es6-polyfills', 'node_modules/babel-polyfill/dist/polyfill.js');
            } else {
                add('es6-polyfills', 'node_modules/babel-polyfill/lib/index.js');
            }
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

    function createJSEnv() {
        // create an object that will receive the env
        var jsenv = {};
        // provide the minimal env available : platform, agent, global, baseAndInternalURl
        buildJSEnv(jsenv);
        return jsenv;
    }

    var jsenv = createJSEnv();
    /*
    why put a variable on the global scope ?
    Considering that in the browser you will put a script tag, you need a pointer on env somewhere
    - we could use System.import('jsenv') but this is a wrapper to System so it would be strange
    to access env with something higher level in terms of abstraction
    - we could count on an other global variable but I don't know any reliable global variable for this purpose
    - because it's a "bad practice" to pollute the global scope the provided global is immediatly removed from the global scope
    */

    /*
    Currently we are having the approach of loading env before SystemJS but we could put SystemJS first
    with the babel transpilation then add babel-polyfill and other polyfill.
    A main issue would be the missing unhandledRejection on promise (so let's just force my polyfill before systemjs in that case)
    else everything is ok

    so we could not use global setup(), we could do System.import('jsenv').then(function(jsenv) {});
    moreover now we want the ability to create multiple env it's not possible
    */

    jsenv.globalName = 'jsenv';
    jsenv.modulePrefix = '@jsenv';
    jsenv.rootModuleName = 'jsenv';
    jsenv.moduleName = 'env';
    jsenv.globalAssignment = jsenv.createCancellableAssignment(jsenv.global, jsenv.globalName);
    jsenv.globalAssignment.assign(jsenv);

    jsenv.build(function() {
        var implementation = {};
        implementation.features = [];

        implementation.add = function(featureName) {
            var existingFeature = this.get(featureName);
            if (existingFeature) {
                throw new Error('The feature ' + featureName + ' already exists');
            }
            var feature = new Feature(featureName);
            this.features.push(feature);
            return feature;
        };
        implementation.get = function(featureName) {
            return find(this.features, function(feature) {
                return feature.name === featureName;
            });
        };
        implementation.getStatus = function(featureName, versionName) {
            var feature = this.get(featureName);
            if (feature === null) {
                return 'unknown';
            }
            versionName = versionName || '*';
            return feature.getStatus(versionName);
        };
        implementation.support = function() {
            return this.getStatus.apply(this, arguments) === 'yes';
        };
        function find(entries, fn) {
            var i = 0;
            var j = entries.length;
            var foundIndex = -1;
            var foundEntry;

            while (i < j) {
                var entry = entries[i];
                if (fn(entry)) {
                    foundIndex = i;
                    foundEntry = entry;
                    break;
                }
                i++;
            }

            return foundIndex === -1 ? null : foundEntry;
        }

        function Feature(name) {
            this.versions = [];
            this.name = name;
        }
        var featureProto = Feature.prototype;
        featureProto.get = function(versionName) {
            return find(this.versions, function(existingVersion) {
                return existingVersion.match(versionName);
            });
        };
        featureProto.add = function(versionName) {
            var existingVersion = this.get(versionName);
            if (existingVersion) {
                throw new Error('The version ' + versionName + ' already exists');
            }
            var version = new FeatureVersion(versionName);
            this.versions.push(version);
            return version;
        };
        featureProto.getStatus = function(versionName) {
            if (arguments.length === 0) {
                versionName = '*';
            }
            var version = this.get(versionName);
            if (version === null) {
                return 'nomatch';
            }
            return version.getStatus();
        };

        var env = this;
        function FeatureVersion(version) {
            this.version = env.createVersion(version);
        }
        var featureVersionProto = FeatureVersion.prototype;
        featureVersionProto.match = function(version) {
            return this.version.match(version);
        };
        featureVersionProto.getStatus = function() {
            var detector = this.detector;
            if (detector) {
                var detectorResult = detector();
                if (typeof detectorResult === 'string') {
                    return detectorResult;
                }
                if (detectorResult) {
                    return 'yes';
                }
                return 'no';
            }
            return 'unspecified';
        };
        featureVersionProto.detect = function(firstArg) {
            var detector;
            if (typeof firstArg === 'boolean') {
                detector = function() {
                    return firstArg;
                };
            } else if (typeof firstArg === 'function') {
                detector = firstArg;
            } else {
                throw new TypeError('feature version detect first arg must be a function or a boolean');
            }
            this.detector = detector;
        };
        featureVersionProto.detectMethod = function(object, methodName) {
            return this.detect(function() {
                return typeof object[methodName] === 'function';
            });
        };
        featureVersionProto.detectObject = function(object, objectName) {
            return this.detect(function() {
                return typeof object[objectName] === 'object';
            });
        };
        featureVersionProto.detectNumber = function(object, numberName) {
            return this.detect(function() {
                return typeof object[numberName] === 'number';
            });
        };

        // some helpers
        featureProto.detect = function(detector) {
            return this.any().detect(detector);
        };
        featureProto.detectMethod = function(object, methodName) {
            return this.any().detectMethod(object, methodName);
        };
        featureProto.detectObject = function(object, objectName) {
            return this.any().detectObject(object, objectName);
        };
        featureProto.detectNumber = function(object, numberName) {
            return this.any().detectNumber(object, numberName);
        };
        featureProto.any = function() {
            var version = this.get('*');
            if (!version) {
                version = this.add('*');
            }
            return version;
        };

        return {
            implementation: implementation
        };
    });

    jsenv.build(function contextualizer() {
        function contextualizer() {
            // http://esprima.org/demo/parse.html#
            var propertyAccessParser = {
                tokenize: (function() {
                    function tokenizer(detectors) {
                        return function(input) {
                            var index = 0;
                            var length = input.length;
                            var tokens = [];
                            var restToken = {
                                type: 'rest',
                                value: ''
                            };

                            while (index < length) {
                                var char = input[index];

                                var i = 0;
                                var j = detectors.length;
                                var detectedToken;
                                while (i < j) {
                                    detectedToken = detectors[i](char, index, input);
                                    if (detectedToken) {
                                        break;
                                    }
                                    i++;
                                }

                                if (detectedToken) {
                                    if (restToken.value.length > 0) {
                                        tokens.push(restToken);
                                        restToken = {
                                            type: 'rest',
                                            value: ''
                                        };
                                    }
                                    tokens.push(detectedToken);
                                    index += detectedToken.value.length;
                                } else {
                                    restToken.value += char;
                                    index += 1;
                                }
                            }

                            if (restToken.value.length > 0) {
                                tokens.push(restToken);
                            }
                            return tokens;
                        };
                    }
                    function token(type, value) {
                        return {
                            type: type,
                            value: value
                        };
                    }
                    var detectors = [
                        function(char) {
                            if (char === '[') {
                                return token('open-bracket', char);
                            }
                        },
                        function(char) {
                            if (char === ']') {
                                return token('close-bracket', char);
                            }
                        },
                        function(char) {
                            if (char === '.') {
                                return token('dot', char);
                            }
                        }
                    ];

                    var tokenize = tokenizer(detectors);

                    return tokenize;
                })(),

                transform: (function() {
                    return function(tokens) {
                        var charIndex = 0;
                        var i = 0;
                        var j = tokens.length;
                        var targets = [];
                        var property;
                        var target;
                        var bracketOpened;

                        function nextTarget() {
                            target = {
                                properties: []
                            };
                        }

                        function nextProperty() {
                            property = '';
                        }

                        function saveProperty() {
                            if (!property) {
                                throw new Error('empty propertyName not allowed');
                            }
                            target.properties.push(property);
                        }

                        function saveTarget() {
                            if (!target) {
                                throw new Error('no target to save');
                            }
                            targets.push(target);
                        }

                        nextTarget();
                        nextProperty();
                        bracketOpened = false;
                        var type;
                        while (i < j) {
                            var token = tokens[i];
                            var value = token.value;
                            type = token.type;

                            if (type === 'rest') {
                                property = value;
                            } else if (type === 'dot') {
                                if (property.length === 0) {
                                    throw new Error('missing name before .');
                                }
                                saveProperty();
                                nextProperty();
                            } else if (type === 'open-bracket') {
                                if (property.length === 0) {
                                    throw new Error('missing name before [');
                                }
                                if (bracketOpened) {
                                    throw new Error('missing ] before [');
                                }
                                saveProperty();
                                nextProperty();
                                saveTarget();
                                nextTarget();
                                bracketOpened = true;
                            } else if (type === 'close-bracket') {
                                if (bracketOpened === false) {
                                    throw new Error('missing [ before ]');
                                }
                                if (property.length === 0) {
                                    throw new Error('missing name between []');
                                }
                                bracketOpened = false;
                            }

                            i++;
                            charIndex += value.length;
                        }
                        if (type === 'rest') {
                            saveProperty();
                            saveTarget();
                        } else if (bracketOpened) {
                            throw new Error('missing ] before and of input');
                        } else if (type === 'close-bracket') {
                            saveProperty();
                            saveTarget();
                        } else if (type === 'dot') {
                            throw new Error('missing name after .');
                        }

                        return targets;
                    };
                })(),

                parse: function(input) {
                    var tokens = this.tokenize(input);
                    var result = this.transform(tokens);
                    return result;
                }
            };

            var cache = {};
            var noValue = {noValue: true};
            function readPath(value, parts) {
                var i = 0;
                var j = parts.length;

                while (i < j) {
                    var part = parts[i];
                    if (part in value) {
                        value = value[part];
                    } else {
                        value = noValue;
                        break;
                    }
                    i++;
                }
                return value;
            }

            var context = {
                act: function() {
                    var action = {};

                    action.dependents = [];
                    action.dependencies = [];
                    action.assertions = [];
                    action.value = noValue;
                    action.valid = true;
                    action.failedAssertion = null;
                    action.tag = 'action';
                    action.assert = function(test, type) {
                        var assertion = {
                            test: test,
                            type: type,
                            result: null
                        };
                        this.assertions.push(assertion);

                        this.dependents.forEach(function(dependent) {
                            dependent.assert(test, type);
                        });

                        if (this.valid) {
                            // ne pas faire deux test du même type
                            // genre constructor + string c'est impossible
                            console.log('calling test on', this.value, 'for', type);
                            var returnValue = test.call(this, this.value);

                            var result = {
                                passed: returnValue,
                                on: this.value
                            };
                            assertion.result = result;

                            if (returnValue) {
                                this.valid = true;
                            } else {
                                this.valid = false;
                                this.failedAssertion = assertion;
                            }
                        } else {
                            // ignore l'assertion on a déjà fail quelque part
                        }
                        return this;
                    };
                    action.instructions = [];
                    action.when = function(condition, sequence) {
                        var instruction = {
                            condition: condition,
                            sequence: sequence
                        };
                        this.instructions.push(instruction);
                        return this;
                    };
                    action.exec = function() {
                        var i = 0;
                        var j = this.instructions.length;
                        var someInstructionMatched = false;
                        var result;
                        while (i < j) {
                            var instruction = this.instructions[i];
                            if (instruction.condition.call(this, this.value)) {
                                someInstructionMatched = true;
                                result = instruction.sequence.call(this, this.value);
                                // break;
                            }
                            i++;
                        }
                        if (someInstructionMatched) {
                            return result;
                        }
                        console.error('no match');
                    };
                    action.adopt = function(action) {
                        if (this.valid) {
                            this.source = action.source;
                            this.path = action.path;
                            this.value = action.value;

                            if (action.valid) {
                                this.valid = true;
                            } else {
                                this.valid = false;
                                this.failedAssertion = action.failedAssertion;
                            }

                            var assertions = action.assertions;
                            var i = 0;
                            var j = assertions.length;
                            while (i < j) {
                                this.assertions.push(assertions[i]);
                                i++;
                            }
                        }
                        console.log('adopting', action);
                        action.dependents.push(this);
                        return this;
                    };

                    return action;
                },

                when: function(condition, action) {
                    return this.act().when(condition, action);
                },

                combine: function() {
                    var actions = arguments;
                    var i = 0;
                    var j = arguments.length;
                    var compositeAction = this.act();

                    while (i < j) {
                        var action = actions[i];
                        compositeAction.adopt(action);
                        i++;
                    }

                    return compositeAction;
                },

                read: function(object, path) {
                    var action;
                    if (path in cache) {
                        action = cache[path];
                    } else {
                        var targets = propertyAccessParser.parse(path);
                        // le fait qu'on cahce les assertions permet que les assertions soit partagées
                        // si elels sont faites en amont
                        // mais si je déclare 'Symbol.iterator' après
                        // bah chuis niqué
                        // et ça n'aurais pas 'effect sur Array.prototype[Symbol.iterator]'
                        var actions = targets.map(function(target) {
                            var action = this.act();
                            action.value = readPath(object, target.properties);
                            action.source = 'path';
                            action.path = target.properties.join('.');
                            action.assert(function(value) {
                                return value !== noValue;
                            }, 'presence');
                            return action;
                        }, this);
                        action = this.combine.apply(this, actions);
                        cache[path] = action;
                    }

                    return action;
                },

                castAction: function(arg) {
                    var action;
                    if (typeof arg === 'object' && arg.tag === 'action') {
                        action = arg;
                    } else {
                        action = this.act();
                        action.source = 'dynamic';
                        action.value = arg;
                    }
                    return action;
                },

                createAssertionFactory: function(test, type) {
                    return function(arg) {
                        var action;
                        if (typeof arg === 'string') {
                            action = this.read(window, arg);
                        } else {
                            action = this.castAction(arg);
                        }
                        action.assert(test, type);
                        return action;
                    }.bind(this);
                },

                createTypeAssertionFactory: function(name, test) {
                    return this.createAssertionFactory(test, 'type:' + name);
                }
            };

            Object.keys(context).forEach(function(key) {
                if (typeof context[key] === 'function') {
                    context[key] = context[key].bind(context);
                }
            });

            return context;
        }

        return {
            contextualizer: contextualizer
        };
    });

    jsenv.build(function makeImplementationScannable() {
        // ne pas utiliser la méthode polyfillWhen sur la feature
        // mais plutot enregister un moyen de check la feature et polyfill lorsque check retourne false
        // il faut aussi ajouter une propriété path sur la feature pour qu'elle sache où elle est censé se trouver
        // la plupart du code dans contextualizer va disparaitre puisque trop compoliqué au vu des besoins
        // une fois qu'on respectera ça

        // y'auras aussi besoin de détecter certain truc qu'on transpile
        // https://github.com/75lb/feature-detect-es6/blob/master/lib/feature-detect-es6.js

        // var implementation = jsenv.implementation;
        var hyphenToCamel = jsenv.hyphenToCamel;
        var context = jsenv.contextualizer.contextualize(jsenv.global);
        var auto = {};
        var autoPrototype = {};
        var autoEs7 = {};
        var register = function() {

        };
        var missing = function() {
            return function() {
                var path = this.path;
                return path;
            };
        };
        var registerAndPolyfillWhen = function(featureGroupPrefix, featureGroupPath, featureGroup) {
            if (featureGroupPath === auto) {
                featureGroupPath = hyphenToCamel(featureGroupPrefix);
            }

            featureGroup.forEach(function(featureValues) {
                var featureName = featureValues[0];
                var featureCondition = featureValues[1];
                var featurePolyfill = featureValues[2];

                var featureFullname;
                if (typeof featureName === 'string') {
                    featureFullname = featureGroupPrefix ? featureGroupPrefix + '-' + featureName : featureName;
                } else {
                    throw new TypeError('feature name must be a string');
                }

                var feature = register(featureFullname);

                var polyfillCondition;
                if (featureCondition === auto) {
                    // missing en faison hypenToCamel
                    polyfillCondition = missing();
                } else if (featureCondition === autoPrototype) {
                    // missing en faisant hypenToCamel et en mattant prototype devant
                } else if (typeof featureCondition === 'string') {
                    polyfillCondition = missing();
                } else if (typeof featureCondition === 'function') {
                    polyfillCondition = featureCondition;
                } else {
                    throw new TypeError('feature polyfilling condition must be a function');
                }

                var polyfillLocation;
                if (featurePolyfill === auto) {
                    polyfillLocation = 'es6';
                    if (featureGroupPrefix) {
                        polyfillLocation += '.' + featureGroupPrefix;
                    }
                    polyfillLocation += featureName;
                } else if (featurePolyfill === autoEs7) {
                    polyfillLocation = 'es7';
                    if (featureGroupPrefix) {
                        polyfillLocation += '.' + featureGroupPrefix;
                    }
                    polyfillLocation += featureName;
                } else if (typeof featurePolyfill === 'string') {
                    polyfillLocation = featurePolyfill;
                } else {
                    throw new TypeError('feature polyfilling location must be a string');
                }

                feature.polyfillWhen(polyfillCondition, polyfillLocation);
            });
        };
        var combine = context.combine;
        var method = context.createTypeAssertionFactory('function', function(value) {
            return typeof value === 'function';
        });
        var some = function() {
            var predicates = arguments;
            var j = predicates.length;
            return function() {
                var someIsValid = false;
                var i = 0;
                while (i < j) {
                    var predicate = predicates[i];
                    if (predicate.apply(this, arguments)) {
                        someIsValid = true;
                        break;
                    }
                    i++;
                }
                return someIsValid;
            };
        };

        // globals
        function checkParseInt() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-int.js
            var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
            ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

            return (
                parseInt(ws + '08') !== 8 ||
                parseInt(ws + '0x16') !== 22
            );
        }
        function checkParseFloat() {
            var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
            ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-float.js
            return 1 / parseFloat(ws + '-0') !== -Infinity;
        }
        var checkPromise = some(
            missing(),
            function() {
                // agent must implement onunhandledrejection to consider promise implementation valid
                if (jsenv.isBrowser()) {
                    if ('onunhandledrejection' in jsenv.global) {
                        return true;
                    }
                    return false;
                }
                if (jsenv.isNode()) {
                    // node version > 0.12.0 got the unhandledRejection hook
                    // this way to detect feature is AWFUL but for now let's do this
                    if (jsenv.agent.version.major > 0 || jsenv.agent.version.minor > 12) {
                        // apprently node 6.1.0 unhandledRejection is not great too, to be tested
                        if (jsenv.agent.version.major === 6 && jsenv.agent.version.minor === 1) {
                            return false;
                        }
                        return true;
                    }
                    return false;
                }
                return false;
            }
        );
        var checkTimer = function() {
            // faudrais check si y'a beosin de fix des truc sous IE9
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/web.timers.js
            return false;
        };
        registerAndPolyfillWhen(
            '',
            '',
            [
                ['asap', auto, autoEs7],
                ['map', auto, auto],
                ['observable', auto, autoEs7],
                ['parseInt', checkParseInt, auto],
                ['parseFloat', checkParseFloat, auto],
                ['promise', checkPromise, auto],
                ['set', auto, auto],
                ['set-immediate', auto, 'web.immediate'],
                ['set-interval', checkTimer, 'web.timers'],
                ['set-timeout', checkTimer, 'web.timers'],
                ['weak-map', auto, auto],
                ['weak-set', auto, auto],

                ['array-buffer', auto, 'es6.typed.array-buffer'],
                ['data-view', auto, 'es6.typed.data-view'],
                ['int8array', auto, 'es6.typed.data-view'],
                ['uint8array', auto, 'es6.typed.uint8-array'],
                ['uint8clamped-array', auto, 'es6.typed.uint8clamped-array'],
                ['int16array', auto, 'es6.typed.int16array-array'],
                ['uint16array', auto, 'es6.typed.uint16-array'],
                ['int32array', auto, 'es6.typed.int32-array'],
                ['uint32array', auto, 'es6.typed.uint32-array'],
                ['float32array', auto, 'es6.typed.float32-array'],
                ['float64array', auto, 'es6.typed.float64-array']
            ]
        );

        // special features
        var checkDomCollection = function() {
            return function() {
                if (jsenv.isBrowser()) {
                    var domCollectionPath = this.path;

                    return combine(
                        method(domCollectionPath),
                        method(domCollectionPath + '.keys'),
                        method(domCollectionPath + '.values'),
                        method(domCollectionPath + '.entries'),
                        method(domCollectionPath + '[Symbol.iterator]')
                    ).valid;
                }
                return false;
            };
        };
        registerAndPolyfillWhen(
            '',
            '',
            [
                ['node-list-iteration', checkDomCollection(), 'web.dom.iterable'],
                ['dom-token-list-iteration', checkDomCollection(), 'web.dom.iterable'],
                ['media-list-iteration', checkDomCollection(), 'web.dom.iterable'],
                ['style-sheet-list-iteration', checkDomCollection(), 'web.dom.iterable'],
                ['css-rule-list-iteration', checkDomCollection(), 'web.dom.iterable']
                // ['typed-array-includes', '???',  'es7.array.includes']
            ]
        );

        // array
        // map, join, filter y'a surement des fix, il ne suffit pas de vérifier que la méthode existe
        registerAndPolyfillWhen(
            'array',
            auto,
            [
                ['copy-within', auto, auto],
                ['every', auto, auto],
                ['find', auto, auto],
                ['find-index', auto, auto],
                ['fill', auto, auto],
                ['filter', auto, auto],
                ['for-each', auto, auto],
                ['from', auto, auto],
                ['index-of', auto, auto],
                ['iterator', 'Array.prototype[Symbol.iterator]', auto],
                ['is-array', auto, auto],
                ['join', auto, auto],
                ['last-index-of', auto, auto],
                ['map', auto, auto],
                ['of', auto, auto],
                ['reduce', auto, auto],
                ['reduce-right', auto, auto],
                ['slice', auto, auto],
                ['some', auto, auto],
                ['sort', auto, auto]
                // ['species', '???', auto]
            ]
        );

        // date
        var checkDateToIsoString = function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
            try {
                // eslint-disable-next-line no-unused-expressions
                if (new Date(-5e13 - 1).toISOString() !== '0385-07-25T07:06:39.999Z') {
                    return false;
                }
            } catch (e) {
                return false;
            }

            try {
                // eslint-disable-next-line no-unused-expressions
                new Date(NaN).toISOString();
            } catch (e) {
                return true;
            }
            return false;
        };
        var checkDateToJSON = function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
            try {
                if (new Date(NaN).toJSON() !== null) {
                    return false;
                }
                var fakeDate = {
                    toISOString: function() {
                        return 1;
                    }
                };
                if (Date.prototype.toJSON.call(fakeDate) !== 1) {
                    return false;
                }
            } catch (e) {
                return false;
            }
            return true;
        };
        var checkDateToString = function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
            return new Date(NaN).toString() === 'Invalid Date';
        };
        registerAndPolyfillWhen(
            'date',
            auto,
            [
                ['now', auto, auto],
                ['to-iso-string', checkDateToIsoString, auto],
                ['to-json', checkDateToJSON, auto],
                ['to-primitive', 'Date.prototype[Symbol.toPrimitive]', auto],
                ['to-string', checkDateToString, auto]
            ]
        );

        // function
        registerAndPolyfillWhen(
            'function',
            auto,
            [
                ['bind', autoPrototype, auto],
                ['name', autoPrototype, auto],
                ['has-instance', 'Function.prototype[Symbol.hasInstance]', auto]
            ]
        );

        // object
        var checkObjectToString = function() {
            // si on a pas Symbol.toStringTag
            // https://github.com/zloirock/core-js/blob/master/modules/es6.object.to-string.js
            var test = {};
            test[Symbol.toStringTag] = 'z';
            return test.toString() === '[object z]';
        };
        registerAndPolyfillWhen(
            'object',
            auto,
            [
                ['assign', auto, auto],
                ['create', auto, auto],
                ['define-getter', 'Object.__defineGetter__', autoEs7],
                ['define-property', auto, auto],
                ['define-properties', auto, autoEs7],
                ['define-setter', 'Object.__defineSetter__', autoEs7],
                ['entries', auto, autoEs7],
                ['freeze', auto, auto],
                ['get-own-property-descriptor', auto, auto],
                ['get-own-property-descriptors', auto, autoEs7],
                ['get-own-property-names', auto, auto],
                ['get-prototypeof', auto, auto],
                ['is', auto, auto],
                ['is-extensible', auto, auto],
                ['is-frozen', auto, auto],
                ['is-sealed', auto, auto],
                ['lookup-getter', 'Object.__lookupGetter__', autoEs7],
                ['lookup-setter', 'Object.__lookupSetter__', autoEs7],
                ['prevent-extensions', auto, auto],
                ['seal', auto, auto],
                ['set-prototype-of', auto, auto],
                ['to-string', checkObjectToString, auto],
                ['values', auto, autoEs7]
            ]
        );

        // symbol
        registerAndPolyfillWhen(
            'symbol',
            auto,
            [
                ['', auto, auto],
                ['async-iterator', auto, autoEs7],
                ['has-instance', auto, auto],
                ['iterator', auto, auto],
                ['match', auto, auto],
                ['observable', auto, autoEs7],
                ['replace', auto, auto],
                ['search', auto, auto],
                ['split', auto, auto],
                ['to-primitive', auto, auto]
            ]
        );

        // math
        registerAndPolyfillWhen(
            'math',
            auto,
            [
                ['acosh', auto, auto],
                ['asinh', auto, auto],
                ['atanh', auto, auto],
                ['cbrt', auto, auto],
                ['clamp', auto, autoEs7],
                ['clz32', auto, auto],
                ['cosh', auto, auto],
                ['deg-per-rad', 'DEG_PAR_RAD', 'es7.math.$0'],
                ['degrees', auto, autoEs7],
                ['expm1', auto, auto],
                ['fround', auto, auto],
                ['fscale', auto, autoEs7],
                ['hypot', auto, auto],
                ['iaddh', auto, autoEs7],
                ['imul', auto, auto],
                ['imulh', auto, auto],
                ['isubh', auto, auto],
                ['log10', auto, auto],
                ['log1p', auto, auto],
                ['log2', auto, auto],
                ['radians', auto, autoEs7],
                ['rad-per-deg', 'RAD_PAR_DEG', 'es7.math.rad-per-deg'],
                ['scale', auto, autoEs7],
                ['sign', auto, auto],
                ['sinh', auto, auto],
                ['tanh', auto, auto],
                ['trunc', auto, auto],
                ['umulh', auto, autoEs7]
            ]
        );

        // number
        var checkNumberConstructor = function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.number.constructor.js#L46
            return (
                Number(' 0o1') &&
                Number('0b1') &&
                !Number('+0x1')
            );
        };
        registerAndPolyfillWhen(
            'number',
            auto,
            [
                ['constructor', checkNumberConstructor, auto],
                ['epsilon', auto, auto],
                ['is-finite', auto, auto],
                ['is-integer', auto, auto],
                ['is-nan', 'isNaN', auto],
                ['is-safe-integer', auto, auto],
                ['iterator', 'prototype[Symbol.iterator]', 'core.number.iterator'],
                ['max-safe-integer', 'MAX_SAFE_INTEGER', auto],
                ['min-safe-integer', 'MIN_SAFE_INTEGER', auto],
                ['to-fixed', autoPrototype, auto],
                ['parse-float', auto, auto],
                ['parse-int', auto, auto]
            ]
        );

        // reflect
        registerAndPolyfillWhen(
            'reflect',
            auto,
            [
                ['apply', auto, auto],
                ['construct', auto, auto],
                ['define-property', auto, auto],
                ['delete-property', 'isNaN', auto],
                ['enumerate', auto, auto],
                ['get', auto, auto],
                ['get-own-property-descriptor', auto, auto],
                ['get-prototype-of', auto, auto],
                ['has', autoPrototype, auto],
                ['own-keys', auto, auto],
                ['prevent-extensions', auto, auto],
                ['set', auto, auto],
                ['set-prototype-of', auto, auto],

                ['define-metadata', auto, autoEs7],
                ['delete-metadata', auto, autoEs7],
                ['get-metadata', autoPrototype, autoEs7],
                ['get-metadata-keys', auto, autoEs7],
                ['get-own-metadata', auto, autoEs7],
                ['get-own-metadata-keys', auto, autoEs7],
                ['has-metadata', auto, autoEs7],
                ['has-own-metadata', auto, autoEs7],
                ['metadata', auto, autoEs7]
            ]
        );

        // regexp
        var checkRegExpConstructor = function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.constructor.js
            var re1 = /a/g;
            var re2 = /a/g;
            re2[Symbol.match] = false;
            var re3 = RegExp(/a/g, 'i');
            return (
                RegExp(re1) === re1 &&
                RegExp(re2) !== re2 &&
                RegExp(re3).toString() === '/a/i'
            );
        };
        var checkRegExpFlags = function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.flags.js
            return /./g.flags === 'g';
        };
        var checkRegExpToString = function() {
            // https://github.com/zloirock/core-js/blob/master/modules/es6.regexp.to-string.js
            var toString = RegExp.prototype.toString;
            return (
                toString.call({source: 'a', flags: 'b'}) === '/a/b' &&
                toString.name === 'toString'
            );
        };
        registerAndPolyfillWhen(
            'regexp',
            auto,
            [
                ['constructor', checkRegExpConstructor, auto],
                ['escape', auto, auto],
                ['flags', checkRegExpFlags, auto],
                ['match', 'RegExp.prototype[Symbol.match]', auto],
                ['replace', 'RegExp.prototype[Symbol.replace]', auto],
                ['search', 'RegExp.prototype[Symbol.search]', auto],
                ['split', 'RegExp.prototype[Symbol.split]', auto],
                ['to-string', checkRegExpToString, auto]
            ]
        );

        // string
        registerAndPolyfillWhen(
            'string',
            auto,
            [
                ['at', autoPrototype, autoEs7],
                ['from-code-point', autoPrototype, auto],
                ['code-point-at', autoPrototype, auto],
                ['ends-with', autoPrototype, auto],
                ['escape-html', auto, 'core.string.escape-html'],
                ['includes', autoPrototype, auto],
                ['iterator', 'String.prototype[Symbol.iterator]', auto],
                ['match-all', 'String.prototype[Symbol.matchAll]', autoEs7],
                ['pad-end', autoPrototype, autoEs7],
                ['pad-start', autoPrototype, autoEs7],
                ['raw', auto, auto],
                ['repeat', autoPrototype, auto],
                ['starts-with', autoPrototype, auto],
                ['trim', autoPrototype, auto],
                ['trim-end', autoPrototype, 'es7.string.trim-right'],
                ['trim-start', autoPrototype, 'es7.string.trim-left'],
                ['unescape-html', auto, 'core.string.unescape-html'],

                ['anchor', autoPrototype, auto],
                ['big', autoPrototype, auto],
                ['blink', autoPrototype, auto],
                ['fixed', autoPrototype, auto],
                ['fontcolor', autoPrototype, auto],
                ['fontsize', autoPrototype, auto],
                ['italics', autoPrototype, auto],
                ['link', autoPrototype, auto],
                ['small', autoPrototype, auto],
                ['strike', autoPrototype, auto],
                ['sub', autoPrototype, auto],
                ['sup', autoPrototype, auto]
            ]
        );
    });

    jsenv.build(function implementationList() {
        // on pourrait imaginer authoriser des requirements avec des versions object-assign@1.0
        // voir même des arguments (eslint ou babel le permettent par ex)

        var implementation = this.implementation;

        implementation.include = function(featureName) {
            implementation.getFeature(featureName).excluded = false;
        };
        implementation.exclude = function(featureName) {
            implementation.getFeature(featureName).excluded = true;
        };

        implementation.list = function() {
            return implementation.features.filter(function(feature) {
                return feature.excluded !== true;
            });
        };
    });

    jsenv.build(function implementationDiff() {
        // on fera un truc comme ça
        /* polyfill/
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

        var implementation = this.implementation;

        implementation.diff = function() {
            var fallbackFiles = [];

            this.list().filter(function(requiredFeature) {
                return requiredFeature.getStatus() !== 'yes';
            }).forEach(function(requiredIncorrectFeature) {
                var fallback = requiredIncorrectFeature.fallback;
                if (!fallback) {
                    throw new Error(
                        'the feature ' + requiredIncorrectFeature.name + ' is missing but has no fallback'
                    );
                }

                if (fallbackFiles.indexOf(fallback) === -1) {
                    fallbackFiles.push(fallback);
                }
            });

            return fallbackFiles;
        };
    });

    // list requirements amongst setimmediate, promise, url, url-search-params, es6 polyfills & SystemJS
    var files = listFiles(jsenv);
    includeFiles(jsenv, files, function() {
        jsenv.SystemPrototype = jsenv.global.System;
        delete jsenv.global.System; // remove System from the global scope
        jsenv.constructor();
    });
})();
