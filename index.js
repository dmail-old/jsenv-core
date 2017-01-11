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

    jsenv.build(function makeImplementationScannable() {
        // l'idée c'est que chaque feature puisse exprimer comment la feature peut être obtenue
        // il est aussi possible qu'on ne puisse pas obtenir la feature via polyfill ou autre
        // il faut alors pouvoir l'exprimer genre fallback: false (par défaut)
        // un moyen d'être polyfill, soit par un fichier distant (quon inclueras dans un build)
        // si fallback est une chaîne alors c'est un fichier distant
        // si c'est une fonction alors on l'apelle
        // y'auras aussi besoin de détecter certain truc qu'on transpile
        // https://github.com/75lb/feature-detect-es6/blob/master/lib/feature-detect-es6.js
        // y'a ptet pas besoin d'une api si spécifique suffit de spécifié ailleurs qu'ici comment
        // on peut polyfill en prévoyant une propriété fallback sur une feature

        var implementation = jsenv.implementation;

        /*
        (function() {
            coreJsFallback('object-assign', 'es6.object.assign');
            coreJsFallback('object-create', 'es6.object.create');
            coreJsFallback('object---define-getter--', 'es7.object.define-getter');
            coreJsFallback('object-define-property', 'es6.object.define-property');
            coreJsFallback('object-define-properties', 'es6.object.define-properties');
            coreJsFallback('object---define-setter--', 'es7.object.define-setter');
            coreJsFallback('object-entries', 'es7.object.entries');
            coreJsFallback('object-freeze', 'es6.object.freeze');
            coreJsFallback('object-get-own-property-descriptor', 'es6.object.get-own-property-descriptor');
            coreJsFallback('object-get-own-property-descriptors', 'es7.object.get-own-property-descriptors');
            coreJsFallback('object-get-own-property-names', 'es6.object.get-own-property-names');
            coreJsFallback('object-get-prototype-of', 'es6.object.get-prototype-of');
            coreJsFallback('object-is', 'es6.object.is');
            coreJsFallback('object-is-extensible', 'es6.object.is-extensible');
            coreJsFallback('object-is-frozen', 'es6.object.is-frozen');
            coreJsFallback('object-is-sealed', 'es6.object.is-sealed');
            coreJsFallback('object-keys', 'es6.object.keys');
            coreJsFallback('object---lookup-getter--', 'es7.object.lookup-getter');
            coreJsFallback('object---lookup-setter--', 'es7.object.lookup-setter');
            coreJsFallback('object-prevent-extensions', 'es6.object.prevent-extensions');
            coreJsFallback('object-seal', 'es6.object.seal');
            coreJsFallback('object-set-prototype-of', 'es6.object.set-prototype-of');
            coreJsFallback('object-to-string', 'es6.object.to-string');
            coreJsFallback('object-values', 'es7.object.values');

            coreJsFallback('symbol', 'es6.symbol');
            // il faudrais aussi mettre tous les symbol-* dans cette catégorie
            coreJsFallback('symbol-async-iterator', 'es7.symbol.async-iterator');
            coreJsFallback('symbol-observable', 'es7.symbol.observable');

            coreJsFallback('math-acosh', 'es6.math.acosh');
            coreJsFallback('math-asinh', 'es6.math.asinh');
            coreJsFallback('math-atanh', 'es6.math.atanh');
            coreJsFallback('math-cbrt', 'es6.math.cbrt');
            coreJsFallback('math-clamp', 'es7.math.clamp');
            coreJsFallback('math-clz32', 'es6.math.clz32');
            coreJsFallback('math-cosh', 'es6.math.cosh');
            coreJsFallback('math-deg-per-rad', 'es7.math.deg-per-rad');
            coreJsFallback('math-degrees', 'es7.math.degrees');
            coreJsFallback('math-expm1', 'es6.math.expm1');
            coreJsFallback('math-fround', 'es6.math.fround');
            coreJsFallback('math-fscale', 'es7.math.fscale');
            coreJsFallback('math-hypot', 'es6.math.hypot');
            coreJsFallback('math-iaddh', 'es7.math.iaddh');
            coreJsFallback('math-imul', 'es6.math.imul');
            coreJsFallback('math-imulh', 'es7.math.imulh');
            coreJsFallback('math-isubh', 'es7.math.isubh');
            coreJsFallback('math-log10', 'es6.math.log10');
            coreJsFallback('math-log1p', 'es6.math.log1p');
            coreJsFallback('math-log2', 'es6.math.log2');
            coreJsFallback('math-radians', 'es7.math.radians');
            coreJsFallback('math-rad-per-deg', 'es7.math.rad-per-deg');
            coreJsFallback('math-scale', 'es7.math.scale');
            coreJsFallback('math-sign', 'es6.math.sign');
            coreJsFallback('math-sinh', 'es6.math.sinh');
            coreJsFallback('math-tanh', 'es6.math.tanh');
            coreJsFallback('math-trunc', 'es6.math.trunc');
            coreJsFallback('math-umulh', 'es7.math.umulh');

            coreJsFallback('number-constructor', 'es6.number.constructor');
            coreJsFallback('number-epsilon', 'es6.number.epsilon');
            coreJsFallback('number-is-finite', 'es6.number.is-finite');
            coreJsFallback('number-is-integer', 'es6.number.is-integer');
            coreJsFallback('number-is-nan', 'es6.number.is-nan');
            coreJsFallback('number-is-safe-integer', 'es6.number.is-safe-integer');
            coreJsFallback('number-iterator', 'core.number.iterator');
            coreJsFallback('number-max-safe-integer', 'es6.number.max-safe-integer');
            coreJsFallback('number-min-safe-integer', 'es6.number.min-safe-integer');
            coreJsFallback('number-to-fixed', 'es6.number.to-fixed');
            coreJsFallback('number-to-precision', 'es6.number.to-precision');
            coreJsFallback('number-parse-float', 'es6.number.parse-float');
            coreJsFallback('number-parse-int', 'es6.number.parse-int');

            coreJsFallback('reflect-apply', 'es6.reflect.apply');
            coreJsFallback('reflect-construct', 'es6.reflect.construct');
            coreJsFallback('reflect-define-property', 'es6.reflect.define-property');
            coreJsFallback('reflect-delete-property', 'es6.reflect.delete-property');
            coreJsFallback('reflect-enumerate', 'es6.reflect.enumerate');
            coreJsFallback('reflect-get', 'es6.reflect.get');
            coreJsFallback('reflect-get-own-property-descriptor', 'es6.reflect.get-own-property-descriptor');
            coreJsFallback('reflect-get-prototype-of', 'es6.reflect.get-prototype-of');
            coreJsFallback('reflect-has', 'es6.reflect.has');
            coreJsFallback('reflect-is-extensible', 'es6.reflect.is-extensible');
            coreJsFallback('reflect-own-keys', 'es6.reflect.own-keys');
            coreJsFallback('reflect-prevent-extensions', 'es6.reflect.prevent-extensions');
            coreJsFallback('reflect-set', 'es6.reflect.set');
            coreJsFallback('reflect-set-prototype-of', 'es6.reflect.set-prototype-of');

            coreJsFallback('reflect-define-metadata', 'es7.reflect.define-metadata');
            coreJsFallback('reflect-delete-metadata', 'es7.reflect.delete-metadata');
            coreJsFallback('reflect-get-metadata', 'es7.reflect.get-metadata');
            coreJsFallback('reflect-get-metadata-keys', 'es7.reflect.get-metadata-keys');
            coreJsFallback('reflect-get-own-metadata', 'es7.reflect.get-own-metadata');
            coreJsFallback('reflect-get-own-metadata-keys', 'es7.reflect.get-own-metadata-keys');
            coreJsFallback('reflect-has-metadata', 'es7.reflect.has-metadata');
            coreJsFallback('reflect-has-own-metadata', 'es7.reflect.has-own-metadata');
            coreJsFallback('reflect-metadata', 'es7.reflect.metadata');

            coreJsFallback('regexp-constructor', 'es6.regexp.constructor');
            coreJsFallback('regexp-escape', 'core.regexp.escape');
            coreJsFallback('regexp-flags', 'es6.regexp.flags');
            coreJsFallback('regexp-match', 'es6.regexp.match');
            coreJsFallback('regexp-replace', 'es6.regexp.replace');
            coreJsFallback('regexp-search', 'es6.regexp.search');
            coreJsFallback('regexp-split', 'es6.regexp.split');
            coreJsFallback('regexp-to-string', 'es6.regexp.to-string');

            coreJsFallback('string-at', 'es7.string.at');
            coreJsFallback('string-from-code-point', 'es6.string.from-code-point');
            coreJsFallback('string-code-point-at', 'es6.string.code-point-at');
            coreJsFallback('string-ends-with', 'es6.string.ends-with');
            coreJsFallback('string-escape-html', 'core.string.escape-html');
            coreJsFallback('string-includes', 'es6.string.includes');
            coreJsFallback('string-iterator', 'es6.string.iterator');
            coreJsFallback('string-match-all', 'es7.string.match-all');
            coreJsFallback('string-pad-end', 'es7.string.pad-end');
            coreJsFallback('string-pad-start', 'es7.string.pad-start');
            coreJsFallback('string-raw', 'es6.string.raw');
            coreJsFallback('string-repeat', 'es6.string.repeat');
            coreJsFallback('string-starts-with', 'es6.string.starts-with');
            coreJsFallback('string-trim', 'es6.string.trim');
            coreJsFallback('string-trim-end', 'es7.string.trim-right');
            coreJsFallback('string-trim-start', 'es7.string.trim-left');
            coreJsFallback('string-unescape-html', 'core.string.unescape-html');

            coreJsFallback('string-anchor', 'es6.string.anchor');
            coreJsFallback('string-big', 'es6.string.big');
            coreJsFallback('string-blink', 'es6.string.blink');
            coreJsFallback('string-fixed', 'es6.string.fixed');
            coreJsFallback('string-fontcolor', 'es6.string.fontcolor');
            coreJsFallback('string-fontsize', 'es6.string.fontsize');
            coreJsFallback('string-italics', 'es6.string.italics');
            coreJsFallback('string-link', 'es6.string.link');
            coreJsFallback('string-small', 'es6.string.small');
            coreJsFallback('string-strike', 'es6.string.strike');
            coreJsFallback('string-sub', 'es6.string.sub');
            coreJsFallback('string-sup', 'es6.string.sup');
        })();
         */

        function register(featureName) {
            var feature = implementation.add(featureName);

            if (arguments.length > 1) {
                var result = readMultiple(jsenv.global, Array.prototype.slice.call(arguments, 1));
                feature.path = result.path;
                feature.status = result.status;
                feature.value = result.value;
            }

            var branches = [];
            feature.when = function(condition, action) {
                var existingBranchWithCondition = branches.find(function(branch) {
                    return branch.condition === condition;
                });
                if (existingBranchWithCondition) {
                    existingBranchWithCondition.action = action;
                } else {
                    branches.push({
                        condition: condition,
                        action: action
                    });
                }
                return this;
            };
            feature.verify = function() {
                var branch = branches.find(function(branch) {
                    return branch.condition.call(this, this.value);
                }, this);
                if (branch) {
                    return branch.action.call(this, this.value);
                }
                throw new Error('feature ' + this.name + ' state has no branch matching his state');
            };

            feature.when(
                missing,
                function() {
                    throw new Error('feature ' + this.name + ' is missing');
                }
            );
            feature.when(
                unreachable,
                function() {
                    throw new Error('feature ' + this.name + ' not found at ' + this.path);
                }
            );

            return feature;
        }
        function readMultiple(initialValue, paths) {
            var i;
            var j = paths.length;
            var result = {};
            var previousResult;
            var singleReadResult;

            i = j;
            while (i--) {
                var path = paths[i];
                singleReadResult = readSingle(initialValue, path);

                propagateResult(singleReadResult, result);
                if (result.has === false) {
                    break;
                }
                if (previousResult) {
                    var propertyResult = readProperty(result.value, previousResult.value);
                    propagateResult(propertyResult, result);
                    if (result.has === false) {
                        break;
                    }
                }
            }

            if (result.has) {
                result.status = 'located';
            } else {
                result.status = i === 0 ? 'missing' : 'notfound';
            }

            var pathString = '';
            i = 0;
            while (i < j) {
                pathString += paths[i];
                if (i > 0) {
                    pathString += ']';
                    if (i < j - 1) {
                        pathString += '[';
                    }
                }
                i++;
            }
            result.path = pathString;

            return result;
        }
        function readSingle(initialValue, path) {
            var parts = path.split('.');
            var i = 0;
            var j = path.length;
            var result = {};
            var value = initialValue;

            while (i < j) {
                var part = parts[i];
                var propertyResult = readProperty(value, part);

                propagateResult(propertyResult, result);
                if (result.has === false) {
                    break;
                }
                i++;
            }

            if (result.has) {
                result.status = 'located';
            } else {
                result.status = i === j - 1 ? 'missing' : 'notfound';
            }

            return result;
        }
        function readProperty(value, propertyName) {
            var result = {};

            if (propertyName in value) {
                result.has = true;
                result.value = value[propertyName];
            } else {
                result.has = false;
                result.value = undefined;
            }

            return result;
        }
        function propagateResult(propertyResult, result) {
            if (propertyResult.has) {
                result.has = true;
                result.value = propertyResult.value;
            } else {
                result.has = false;
                result.value = undefined;
            }
        }
        function missing() {
            return this.status === 'missing';
        }
        function unreachable() {
            return this.status === 'unreachable';
        }
        function notFunction(value) {
            return typeof value !== 'function';
        }
        // function notString(value) {
        //     return typeof value !== 'string';
        // }
        // function notNumber(value) {
        //     return typeof value !== 'number';
        // }
        // function notSymbol(value) {
        //     return value instanceof Symbol === false;
        // }
        function createMatchHelper(condition, action) {
            var feature = register.apply(this, arguments);

            feature.when(
                condition,
                action
            );

            return feature;
        }
        var method = createMatchHelper(notFunction, function() {
            throw new TypeError('feature ' + this.name + ' was expected to be a function');
        });
        // var string = createMatchHelper(notString, function() {
        //     throw new TypeError('feature ' + this.name + ' was expected to be a string');
        // });
        // var number = createMatchHelper(notNumber, function() {
        //     throw new TypeError('feature ' + this.name + ' was expected to be a number');
        // });
        // var symbol = createMatchHelper(notSymbol, function() {
        //     throw new TypeError('feature ' + this.name + ' was expected to be a symbol');
        // });
        var constructor = method;
        function polyfill() {

        }
        function or() {

        }

        constructor('asap', 'asap').when(
            missing,
            polyfill('es7.asap')
        );
        constructor('map', 'Map').when(
            missing,
            polyfill('es6.map')
        );
        constructor('observable', 'Observable').when(
            missing,
            polyfill('es7.observable')
        );
        (function() {
            var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
            ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

            method('parse-int', 'parseInt').when(
                function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-int.js
                    return (
                        parseInt(ws + '08') !== 8 ||
                        parseInt(ws + '0x16') !== 22
                    );
                },
                polyfill('es6.parse-int')
            );
            method('parse-float', 'parseFloat').when(
                function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-float.js
                    return 1 / parseFloat(ws + '-0') === -Infinity;
                },
                polyfill('es6.parse-float')
            );
        })();
        constructor('promise', 'Promise').when(
            or(missing, function() {
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
            }),
            polyfill('es6.promise')
        );
        constructor('set', 'Set').when(
            missing,
            polyfill('es6.set')
        );
        method('set-immediate', 'setImmediate').when(
            missing,
            polyfill('web.immediate')
        );

        (function() {
            function brokeanTimerDetector() {
                // faudrais check si y'a beosin de fix des truc sous IE9
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/web.timers.js
                return false;
            }

            method('set-interval', 'setInterval').when(
                brokeanTimerDetector,
                polyfill('web.timers')
            );
            method('set-timeout', 'setTimeout').when(
                brokeanTimerDetector,
                'web.timers'
            );
        })();
        constructor('weak-map', 'WeakMap').when(
            missing,
            polyfill('es6.weak-map')
        );
        constructor('weak-set', 'WeakSet').when(
            missing,
            polyfill('es6.weak-set')
        );
        constructor('array-buffer', 'ArrayBuffer').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('data-view', 'DataView').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('int8array', 'Int8array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('uint8array', 'Uint8array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('uint8clamped-array', 'Uint8ClampedArray').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('int16array', 'Int16array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('uint16array', 'Uint16array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('int32array', 'Int32array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('uint32array', 'Uint32array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('float32array', 'Float32array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );
        constructor('float64array', 'Float64Array').when(
            missing,
            polyfill('es6.typed.array-buffer')
        );

        // feature('typed-array-includes', 'Array.prototype.includes').polyfill('es7.array.includes');
        (function() {
            if (jsenv.isBrowser()) {
                // il faut un peu changer les helpers
                // afn de vraiment pouvoir utiliser ce qu'on voit ci dessous
                // c'est à dire de pouvoir lire non plus depuis jsenv.global mais
                // DomCollection
                // mais aussi que l'état de la feature puisse être composé de létat d'autre
                // feature qui ne sont pas forcément register

                var notIterable = or(
                    function(DomCollection) {
                        this.method(DomCollection, 'keys');
                    },
                    function(DomCollection) {
                        this.method(DomCollection, 'values');
                    },
                    function(DomCollection) {
                        this.method(DomCollection, 'entries');
                    },
                    function(DomCollection) {
                        this.method(DomCollection, 'Symbol.iterator');
                    }
                );

                constructor('node-list-iterable', 'NodeList').when(
                    notIterable,
                    polyfill('web.dom.iterable')
                );
                constructor('dom-token-list-iterable', 'DomTokenList').when(
                    notIterable,
                    polyfill('web.dom.iterable')
                );
                constructor('media-list-iterable', 'MediaList').when(
                    notIterable,
                    polyfill('web.dom.iterable')
                );
                constructor('style-sheet-list-iterable', 'StyleSheetList').when(
                    notIterable,
                    polyfill('web.dom.iterable')
                );
                constructor('css-rule-list-iterable', 'CSSRuleList').when(
                    notIterable,
                    polyfill('web.dom.iterable')
                );
            }
        })();

        /*
        // map, join, filter y'a surement des fix, il ne suffit pas de vérifié que la méthode existe
        method('array-copy-within', 'Array.copyWithin').polyfill('es6.array.copy-within');
        method('array-every', 'Array.every').polyfill('es6.array.every');
        method('array-find', 'Array.find').polyfill('es6.array.find');
        method('array-find-index', 'Array.findIndex').polyfill('es6.array.find-index');
        method('array-fill', 'Array.fill').polyfill('es6.array.fill');
        method('array-filter', 'Array.filter').polyfill('es6.array.filer');
        method('array-for-each', 'Array.forEach').polyfill('es6.array.for-each');
        method('array-from', 'Array.from').polyfill('es6.array.from');
        method('array-index-of', 'Array.indexOf').polyfill('es6.array.index-of');

        method('array-iterator', 'Array.prototype', 'Symbol.iterator').when(
            missing,
            polyfill('es6.array.iterator')
        );
        method('array-is-array', 'Array.isArray').polyfill('es6.array.is-array');
        method('array-join', 'Array.join').polyfill('es6.array.join');
        method('array-last-index-of', 'Array.lastIndexOf').polyfill('es6.array.last-index-of');
        method('array-map', 'Array.map').polyfill('es6.array.map');
        method('array-of', 'Array.of').polyfill('es6.array.of');
        method('array-reduce', 'Array.reduce').polyfill('es6.array.reduce');
        method('array-reduce-right', 'Array.reduceRight').polyfill('es6.array.reduce-right');
        method('array-slice', 'Array.slice').polyfill('es6.array.slice');
        method('array-some', 'Array.some').polyfill('es6.array.some');
        method('array-sort', 'Array.sort').polyfill('es6.array.sort');

        // map, join, filter y'a surement des fix, il ne suffit pas de vérifié que la méthode existe
        // coreJsFallback('array-species', 'es6.array.species');
        // add('array-species', null);

        method('date-now', 'Date.now').polyfill('es6.date.now');
        method('date-to-iso-string', 'Date.prototype.toISOString').valid(function() {
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
        }).polyfill('es6.date.to-iso-string', 'invalid');
        method('date-to-json', 'Date.prototype.toJSON').valid(function() {
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
        }).polyfill('es6.date.to-json');
        // un peu comme pour array-iterator au dessus
        // feature('date-to-primitive', detectSymbol('Date.prototype.toPrimitive')).polyfil('es6.date.to-primitive');
        method('date-to-string', 'Date.prototype.toString').valid(function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
            return new Date(NaN).toString() === 'Invalid Date';
        }).polyfill('es6.date.to-string', 'invalid');

        method('function-bind', 'Function.prototype.bind').polyfill('es6.function.bind');
        string('function-name', 'Function.prototype.name').polyfill('es6.function.name');
        // add('function-has-instance', detectSymbol('Function.prototype.hasInstance')).polyfill('es6.function.has-instance');

        add('object-assign', detectMethod('Object.assign'));
        add('object-create', detectMethod('Object.create'));
        add('object---define-getter--', detectMethod('Object.__defineGetter__'));
        add('object-define-property', detectMethod('Object.defineProperty'));
        add('object-define-properties', detectMethod('Object.defineProperties'));
        add('object---define-setter--', detectMethod('Object.__defineSetter__'));
        add('object-entries', detectMethod('Object.entries'));
        add('object-freeze', detectMethod('Object.freeze'));
        add('object-get-own-property-descriptor', detectMethod('Object.getOwnPropertyDescriptor'));
        add('object-get-own-property-descriptors', detectMethod('Object.getOwnPropertyDescriptors'));
        add('object-get-own-property-names', detectMethod('Object.getOwnPropertyNames'));
        add('object-get-prototype-of', detectMethod('Object.getPrototypeOf'));
        add('object-is', detectMethod('Object.is'));
        add('object-is-extensible', detectMethod('Object.isExtensible'));
        add('object-is-frozen', detectMethod('Object.isFrozen'));
        add('object-is-sealed', detectMethod('Object.isSealed'));
        add('object-keys', detectMethod('Object.keys'));
        add('object---lookup-getter--', detectMethod('Object.__lookupGetter__'));
        add('object---lookup-setter--', detectMethod('Object.__lookupSetter__'));
        add('object-prevent-extensions', detectMethod('Object.preventExtensions'));
        add('object-seal', detectMethod('Object.seal'));
        add('object-set-prototype-of', detectMethod('Object.setPrototypeOf'));
        add('object-to-string', ensure('Object.prototype.toString').isFunction().and(
            function() {
                return expect('Symbol.toStringTag').isSymbol();
            }
        ).test(function() {
            // https://github.com/zloirock/core-js/blob/master/modules/es6.object.to-string.js
            var test = {};
            test[Symbol.toStringTag] = 'z';
            return test.toString() === '[object z]';
        }));
        add('object-values', detectMethod('Object.values'));

        add('symbol', detectConstructor('Symbol'));
        add('symbol-async-iterator', detectSymbol('Symbol.asyncIterator'));
        add('symbol-has-instance', detectSymbol('Symbol.hasInstance'));
        add('symbol-iterator', detectSymbol('Symbol.iterator'));
        add('symbol-match', detectSymbol('Symbol.match'));
        add('symbol-observable', detectSymbol('Symbol.observable'));
        symbol('symbol-replace', 'Symbol.replace').when(
            missing,
            polyfill()
        );
        add('symbol-search', detectSymbol('Symbol.search'));
        add('symbol-split', detectSymbol('Symbol.split'));
        add('symbol-to-primitive', detectSymbol('Symbol.toPrimitive'));

        add('math-acosh', detectMethod('Math.acosh'));
        add('math-asinh', detectMethod('Math.asinh'));
        add('math-atanh', detectMethod('Math.atanh'));
        add('math-cbrt', detectMethod('Math.cbrt'));
        add('math-clamp', detectMethod('Math.clamp'));
        add('math-clz32', detectMethod('Math.clz32'));
        add('math-cosh', detectMethod('Math.cosh'));
        number('math-deg-per-rad', 'Math.DEG_PER_RAD').when(
            missing,
            polyfill()
        );
        add('math-degrees', detectMethod('Math.degrees'));
        add('math-expm1', detectMethod('Math.expm1'));
        add('math-fround', detectMethod('Math.fround'));
        add('math-fscale', detectMethod('Math.fscale'));
        add('math-hypot', detectMethod('Math.hypot'));
        add('math-iaddh', detectMethod('Math.iaddh'));
        add('math-imul', detectMethod('Math.imul'));
        add('math-imulh', detectMethod('Math.imulh'));
        add('math-isubh', detectMathMethod('Math.isubh'));
        add('math-log10', detectMethod('Math.log10'));
        add('math-log1p', detectMethod('Math.log1p'));
        add('math-log2', detectMethod('Math.log2'));
        add('math-radians', detectMethod('Math.radians'));
        add('math-rad-per-deg', detectNumber('Math.RAD_PER_DEG'));
        add('math-scale', detectMethod('Math.scale'));
        add('math-sign', detectMethod('Math.sign'));
        add('math-sinh', detectMethod('Math.sinh'));
        add('math-tanh', detectMethod('Math.tanh'));
        add('math-trunc', detectMethod('Math.trunc'));
        add('math-umulh', detectMethod('Math.umulh'));

        add('number-constructor', function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.number.constructor.js#L46
            return (
                Number(' 0o1') &&
                Number('0b1') &&
                !Number('+0x1')
            );
        });
        add('number-epsilon', detectNumber('Number.epsilon'));
        add('number-is-finite', detectMethod('Number.isFinite'));
        add('number-is-integer', detectMethod('Number.isInteger'));
        add('number-is-nan', detectMethod('Number.isNaN'));
        add('number-is-safe-integer', detectMethod('Number.isSafeInteger'));
        add('number-iterator', detectSymbol('Number.prototype.iterator'));
        add('number-max-safe-integer', detectNumber('Number.MAX_SAFE_INTEGER'));
        add('number-min-safe-integer', detectNumber('Number.MIN_SAFE_INTEGER'));
        add('number-to-fixed', detectMethod('Number.prototype;toFixed'));
        add('number-to-precision', detectMethod('Number.prototype.toPrecision'));
        add('number-parse-float', detectMethod('Number.parseFloat'));
        add('number-parse-int', detectMethod('Number.parseInt'));

        add('reflect-apply', detectMethod('Reflect.apply'));
        add('reflect-construct', detectMethod('Reflect.construct'));
        add('reflect-define-property', detectMethod('Reflect.defineProperty'));
        add('reflect-delete-property', detectMethod('Reflect.deleteProperty'));
        add('reflect-enumerate', detectMethod('Reflect.enumerate'));
        add('reflect-get', detectMethod('Reflect.get'));
        add('reflect-get-own-property-descriptor', detectMethod('Reflect.getownPropertyDescriptor'));
        add('reflect-get-prototype-of', detectMethod('Reflect.getPrototypeOf'));
        add('reflect-has', detectMethod('Reflect.has'));
        add('reflect-is-extensible', detectMethod('Reflect.isExtensible'));
        add('reflect-own-keys', detectMethod('Reflect.ownKeys'));
        add('reflect-prevent-extensions', detectMethod('Reflect.preventExtensions'));
        add('reflect-set', detectMethod('Reflect.set'));
        add('reflect-set-prototype-of', detectMethod('Reflect.setPrototypeOf'));

        add('reflect-define-metadata', detectMethod('Reflect.defineMetadata'));
        add('reflect-delete-metadata', detectMethod('Reflect.deleteMetadata'));
        add('reflect-get-metadata', detectMethod('Reflect.getMetadata'));
        add('reflect-get-metadata-keys', detectMethod('Reflect.getMetadataKeys'));
        add('reflect-get-own-metadata', detectMethod('Reflect.getOwnMetadata'));
        add('reflect-get-own-metadata-keys', detectMethod('gReflect.etOwnMetadataKeys'));
        add('reflect-has-metadata', detectMethod('Reflect.hasMetadata'));
        add('reflect-has-own-metadata', detectMethod('Reflect.hasOwnMetadata'));
        add('reflect-metadata', detectMethod('Reflect.metadata'));

        add('regexp-constructor', combineTest(
            detectSymbol('Symbol.match'),
            function() {
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
            }
        ));
        add('regexp-escape', detectMethod('RegExp.escape'));
        add('regexp-flags', function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.flags.js
            return /./g.flags === 'g';
        });
        add('regexp-match', detectSymbol('RegExp.match'));
        add('regexp-replace', detectSymbol('RegExp.replace'));
        add('regexp-search', detectSymbol('RegExp.search'));
        add('regexp-split', detectSymbol('RegExp.split'));
        add('regexp-to-string', function() {
            // https://github.com/zloirock/core-js/blob/master/modules/es6.regexp.to-string.js
            var toString = RegExp.prototype.toString;
            return (
                toString.call({source: 'a', flags: 'b'}) === '/a/b' &&
                toString.name === 'toString'
            );
        });

        add('string-at', detectMethod('String.prototype.at'));
        add('string-from-code-point', detectMethod('String.prototype.fromCodePoint'));
        add('string-code-point-at', detectMethod('String.prototype.codePointAt'));
        add('string-ends-with', detectMethod('String.prototype.endsWith'));
        add('string-escape-html', detectMethod('String.escapeHTML'));
        add('string-includes', detectMethod('String.prototype.includes'));
        add('string-iterator', detectSymbol('String.prototype.iterator'));
        add('string-match-all', detectSymbol('String.prototype.matchAll'));
        add('string-pad-end', detectMethod('String.prototype.padEnd'));
        add('string-pad-start', detectMethod('String.prototype.padStart'));
        add('string-raw', detectMethod('String.raw'));
        add('string-repeat', detectMethod('String.prototype.repeat'));
        add('string-starts-with', detectMethod('String.prototype.startsWith'));
        add('string-trim', detectMethod('String.prototype.trim'));
        add('string-trim-end', detectMethod('String.prototype.trimEnd'));
        add('string-trim-start', detectMethod('String.prototype.trimStart'));
        add('string-unescape-html', detectMethod('String.unescapeHTML'));

        add('string-anchor', detectMethod('String.prototype.anchor'));
        add('string-big', detectMethod('String.prototype.big'));
        add('string-blink', detectMethod('String.prototype.blink'));
        add('string-fixed', detectMethod('String.prototype.fixed'));
        add('string-fontcolor', detectMethod('String.prototype.fontcolor'));
        add('string-fontsize', detectMethod('String.prototype.fontsize'));
        add('string-italics', detectMethod('String.prototype.italics'));
        add('string-link', detectMethod('String.prototype.link'));
        add('string-small', detectMethod('String.prototype.small'));
        add('string-strike', detectMethod('String.prototype.strike'));
        add('string-sub', detectMethod('String.prototype.sub'));
        add('string-sup', detectMethod('String.prototype.sup'));
        */
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
