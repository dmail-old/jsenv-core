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
    function assign(object, properties) {
        for (var key in properties) { // eslint-disable-line
            object[key] = properties[key];
        }
        return object;
    }

    function buildJSEnv(jsenv) {
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
            var anyChar = '*';
            var hiddenChar = '?';

            function VersionPart(value) {
                if (value === anyChar) {
                    this.value = value;
                } else if (isNaN(value)) {
                    // I dont wanna new Version to throw
                    // in the worst case you end with a version like '?.?.?' but not an error
                    this.error = new Error('version part must be a number or * (not ' + value + ')');
                    this.value = hiddenChar;
                } else {
                    this.value = parseInt(value);
                }
            }
            VersionPart.prototype = {
                isAny: function() {
                    return this.value === anyChar;
                },

                isHidden: function() {
                    return this.value === hiddenChar;
                },

                isPrecise: function() {
                    return this.isAny() === false && this.isHidden() === false;
                },

                match: function(other) {
                    return (
                        this.isAny() ||
                        other.isAny() ||
                        this.value === other.value
                    );
                },

                above: function(other) {
                    return (
                        this.isPrecise() &&
                        other.isPrecise() &&
                        this.value > other.value
                    );
                },

                below: function(other) {
                    return (
                        this.isPrecise() &&
                        other.isPrecise() &&
                        this.value < other.value
                    );
                },

                valueOf: function() {
                    return this.value;
                },

                toString: function() {
                    return String(this.value);
                }
            };

            function Version(firstArg) {
                var versionName = String(firstArg);
                var major;
                var minor;
                var patch;

                if (versionName === anyChar) {
                    major = new VersionPart(anyChar);
                    minor = new VersionPart(anyChar);
                    patch = new VersionPart(anyChar);
                } else if (versionName.indexOf('.') === -1) {
                    major = new VersionPart(versionName);
                    minor = new VersionPart(0);
                    patch = new VersionPart(0);
                } else {
                    var versionParts = versionName.split('.');
                    var versionPartCount = versionParts.length;

                    // truncate too precise version
                    if (versionPartCount > 3) {
                        versionParts = versionParts.slice(0, 3);
                        versionPartCount = 3;
                        this.truncated = true;
                    }

                    if (versionPartCount === 2) {
                        major = new VersionPart(versionParts[0]);
                        minor = new VersionPart(versionParts[1]);
                        patch = new VersionPart(0);
                    } else if (versionPartCount === 3) {
                        major = new VersionPart(versionParts[0]);
                        minor = new VersionPart(versionParts[1]);
                        patch = new VersionPart(versionParts[2]);
                    }
                }

                this.major = major;
                this.minor = minor;
                this.patch = patch;
                this.raw = firstArg;
            }
            Version.cast = function(firstArg) {
                var version;
                if (typeof firstArg === 'string') {
                    version = new Version(firstArg);
                } else if (firstArg instanceof Version) {
                    version = firstArg;
                } else {
                    throw new Error('version.match expect a string or a version object');
                }
                return version;
            };

            Version.prototype = {
                constructor: Version,
                isPrecise: function() {
                    return (
                        this.major.isPrecise() &&
                        this.minor.isPrecise() &&
                        this.patch.isPrecise()
                    );
                },

                isTrustable: function() {
                    return (
                        this.major.isHidden() === false &&
                        this.minor.isHidden() === false &&
                        this.patch.isHidden() === false
                    );
                },

                match: function(firstArg) {
                    var version = Version.cast(firstArg);

                    return (
                        this.major.match(version.major) &&
                        this.minor.match(version.minor) &&
                        this.patch.match(version.patch)
                    );
                },

                above: function(firstArg, loose) {
                    var version = Version.cast(firstArg);

                    return (
                        this.major.above(version.major) ||
                        this.minor.above(version.minor) ||
                        this.patch.above(version.patch) ||
                        loose
                    );
                },

                below: function(firstArg, loose) {
                    var version = Version.cast(firstArg);

                    return (
                        this.major.below(version.major) ||
                        this.minor.below(version.minor) ||
                        this.patch.below(version.patch) ||
                        loose
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

            // exceptionHandler.enable();
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

    function createJSEnv() {
        // create an object that will receive the env
        var jsenv = {};
        // provide the minimal env available : platform, agent, global, baseAndInternalURl
        buildJSEnv(jsenv);
        return jsenv;
    }

    var Iterable = {};
    Iterable.forEach = function forEach(iterable, fn, bind) {
        var i = 0;
        var j = iterable.length;
        while (i < j) {
            fn.call(bind, iterable[i], i, iterable);
            i++;
        }
        return iterable;
    };
    Iterable.map = function map(iterable, fn, bind) {
        var mappedIterable = [];
        Iterable.forEach(iterable, function(entry, i) {
            mappedIterable[i] = fn.call(bind, entry, i, iterable);
        });
        return mappedIterable;
    };
    Iterable.filter = function filter(iterable, fn, bind) {
        var filteredIterable = [];
        Iterable.forEach(iterable, function(entry, index, iterable) {
            if (fn.call(bind, entry, index, iterable)) {
                filteredIterable.push(entry);
            }
        });
        return filteredIterable;
    };
    Iterable.find = function find(iterable, fn, bind) {
        var i = 0;
        var j = iterable.length;
        var foundIndex = -1;
        var foundEntry;

        while (i < j) {
            var entry = iterable[i];
            if (fn.call(bind, entry, i, iterable)) {
                foundIndex = i;
                foundEntry = entry;
                break;
            }
            i++;
        }

        return foundIndex === -1 ? null : foundEntry;
    };
    Iterable.includes = function includes(iterable, item) {
        return iterable.indexOf(item) > -1;
    };
    Iterable.every = function every(iterable, fn, bind) {
        var everyEntryIsTruthy = true;
        var i = 0;
        var j = iterable.length;
        while (i < j) {
            if (Boolean(fn.call(bind, iterable[i], i, iterable)) === false) {
                everyEntryIsTruthy = false;
                break;
            }
            i++;
        }
        return everyEntryIsTruthy;
    };
    Iterable.some = function some(iterable, fn, bind) {
        var someEntryIsTruthy = false;
        var i = 0;
        var j = iterable.length;
        while (i < j) {
            if (fn.call(bind, iterable[i], i, iterable)) {
                someEntryIsTruthy = true;
                break;
            }
            i++;
        }
        return someEntryIsTruthy;
    };
    Iterable.bisect = function bisect(iterable, fn, bind) {
        var firstHalf = [];
        var secondHalf = [];

        Iterable.forEach(iterable, function(entry, index) {
            if (fn.call(bind, entry, index, iterable)) {
                firstHalf.push(entry);
            } else {
                secondHalf.push(entry);
            }
        });

        return [firstHalf, secondHalf];
    };

    var Predicate = {};
    Predicate.not = function(predicate) {
        return function() {
            return !predicate.apply(this, arguments);
        };
    };
    Predicate.fails = function(fn) {
        return function() {
            try {
                fn.apply(this, arguments);
                return false;
            } catch (e) {
                return true;
            }
        };
    };
    Predicate.some = function() {
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
    Predicate.every = function() {
        var predicates = arguments;
        var j = predicates.length;
        if (j === 0) {
            throw new Error('misisng arg to every');
        }
        return function() {
            var everyAreValid = true;
            var i = 0;
            while (i < j) {
                var predicate = predicates[i];
                if (!predicate.apply(this, arguments)) {
                    everyAreValid = false;
                    break;
                }
                i++;
            }
            return everyAreValid;
        };
    };

    var jsenv = createJSEnv();
    jsenv.Iterable = Iterable;
    jsenv.Predicate = Predicate;

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

    jsenv.build(function implementation() {
        var implementation = {};
        implementation.features = [];

        implementation.createFeature = function() {
            return new VersionnedFeature();
        };
        implementation.add = function(feature) {
            if (feature.name === '') {
                throw new Error('cannot add a feature with empty name');
            }

            var existingFeature = implementation.find(feature);
            if (existingFeature) {
                throw new Error('The feature ' + existingFeature + ' already exists');
            }
            this.features.push(feature);
            return feature;
        };
        implementation.find = function(searchedFeature) {
            return Iterable.find(this.features, function(feature) {
                return feature.match(searchedFeature);
            });
        };
        implementation.get = function(featureName, featureVersion) {
            var searchedFeature = new VersionnedFeature(featureName, featureVersion || '*');
            var foundVersionnedFeature = implementation.find(searchedFeature);
            if (!foundVersionnedFeature) {
                throw new Error('feature not found ' + searchedFeature);
            }
            return foundVersionnedFeature;
        };
        implementation.support = function() {
            var versionnedFeature = this.get.apply(this, arguments);
            if (versionnedFeature) {
                return versionnedFeature.isValid();
            }
            return false;
        };

        var env = this;
        function VersionnedFeature() {
            this.excluded = false;
            this.dependents = [];
            this.dependencies = [];

            var arity = arguments.length;
            if (arity > 0) {
                this.name = arguments[0];
            } else {
                this.name = '';
            }
            if (arity > 1) {
                this.setVersion(arguments[1]);
            } else {
                this.setVersion('*');
            }
        }
        var VersionnedFeaturePrototype = VersionnedFeature.prototype;
        VersionnedFeaturePrototype.setVersion = function(version) {
            this.version = env.createVersion(version);
        };
        VersionnedFeaturePrototype.status = 'unspecified';
        VersionnedFeaturePrototype.toString = function() {
            return this.name + '@' + this.version;
        };
        VersionnedFeaturePrototype.relyOn = function() {
            Iterable.forEach(arguments, function(arg) {
                var dependentFeature;
                if (typeof arg === 'string') {
                    dependentFeature = implementation.get(arg);
                    if (!dependentFeature) {
                        throw new Error('cannot find dependency ' + arg + ' of ' + this.name);
                    }
                } else {
                    dependentFeature = arg;
                }

                if (Iterable.includes(this.dependents, dependentFeature)) {
                    throw new Error('cyclic dependency between ' + dependentFeature.name + ' and ' + this.name);
                }

                this.dependencies.push(dependentFeature);
                dependentFeature.dependents.push(this);
            }, this);
        };
        VersionnedFeaturePrototype.exclude = function(reason) {
            this.excluded = true;
            this.exclusionReason = reason;
            Iterable.forEach(this.dependents, function(dependent) {
                dependent.exclude(reason);
            });
            return this;
        };
        VersionnedFeaturePrototype.include = function(reason) {
            this.excluded = false;
            this.exclusionReason = null;
            this.inclusionReason = reason;
            Iterable.forEach(this.dependencies, function(dependency) {
                dependency.include(reason);
            });
            return this;
        };
        VersionnedFeaturePrototype.isExcluded = function() {
            return this.excluded === true;
        };
        VersionnedFeaturePrototype.isIncluded = function() {
            return this.excluded !== true;
        };
        // isValid & isInvalid or not opposite because status may be 'unspecified'
        VersionnedFeaturePrototype.isValid = function() {
            return this.status === 'valid';
        };
        VersionnedFeaturePrototype.isInvalid = function() {
            return this.status === 'invalid';
        };
        VersionnedFeaturePrototype.match = function(other) {
            return (
                this === other || (
                    this.name === other.name &&
                    this.version.match(other.version)
                )
            );
        };
        VersionnedFeaturePrototype.updateStatus = function(callback) {
            var feature = this;
            var settled = false;
            var settle = function(valid, reason, detail) {
                if (settled === false) {
                    var arity = arguments.length;

                    if (arity === 0) {
                        feature.status = 'unspecified';
                        feature.statusReason = undefined;
                        feature.statusDetail = undefined;
                    } else {
                        feature.status = valid ? 'valid' : 'invalid';
                        feature.statusReason = reason;
                        feature.statusDetail = detail;
                    }

                    settled = true;
                    callback(feature);
                }
            };

            var dependencies = feature.dependencies;
            var invalidDependency = Iterable.find(dependencies, function(dependency) {
                return dependency.isInvalid();
            });
            if (invalidDependency) {
                settle(false, 'dependency-is-invalid', invalidDependency);
            } else {
                var test = feature.test;

                if (!test) {
                    throw new Error('feature ' + this + ' has no test');
                }
                var returnValue;
                var throwedValue;
                var hasThrowed = false;
                var hasReturned = false;

                // async stuff
                if (test.length > 0) {
                    try {
                        test.call(
                            feature,
                            settle
                        );

                        var asyncTestMaxDuration = 100;
                        setTimeout(function() {
                            settle(false, 'timeout', asyncTestMaxDuration);
                        }, asyncTestMaxDuration);
                    } catch (e) {
                        hasThrowed = true;
                        throwedValue = e;
                    }
                } else {
                    try {
                        returnValue = test.call(feature);
                        hasReturned = true;
                    } catch (e) {
                        hasThrowed = true;
                        throwedValue = e;
                    }
                }

                if (hasThrowed) {
                    settle(false, 'throwed', throwedValue);
                } else if (hasReturned) {
                    settle(Boolean(returnValue), 'return', returnValue);
                }
            }

            return this;
        };
        // VersionnedFeaturePrototype.freezeStatus = function() {
        //     this.statusFrozen = true;
        // };

        return {
            implementation: implementation
        };
    });

    jsenv.build(function registerStandardFeatures() {
        /*
        // et au lieu d'avoir des noms on nomme juste les fonctions
        // et come ça on passe une liste des fonctions qui servet à savoir dan squel état est la feature
        // sachant que detect va par défaut utiliser le nom de la feature
        // attention il manque un truc important :
        // lorsque la feature a des dépendances (je pense qu'on l'exprime alors en 2nd arg de registerStandard)
        registerStandard('asap').expect(
            presence,
            function calledBeforeSetTimeout(resolve, reject) {
                // certains tests peuvent être asynchrones
                // dans ce cas jai un souci parce que je peut pas compter sur les promesses
                // et en plus ça va forcer la plupart de mes fonctions à devenir asychrone
                // c'est pas forcément un souci mais ça a des impacts énorme
                // comment savoir si le test est synchrone ? arguments.length > 0

                var asap = this.value;
                var setTimeoutCalledBeforeAsap = false;
                setTimeout(function() {
                    setTimeoutCalledBeforeAsap = true;
                }, 1);
                asap(function() {
                    if (setTimeoutCalledBeforeAsap) {
                        reject();
                    } else {
                        resolve();
                    }
                });
            }
        );

        registerSyntax('const').expect(
            presence,
            {
                name: 'scoped-for-of',
                dependencies: ['for-of'],
                test: function() {
                    return true;
                }
            }
        );

        registerStandardFeatures('global',
            {name: 'asap', spec: 'es7'},
            {name: 'map', type: 'constructor'},
            {name: 'observable', type: 'constructor', spec: 'es7'},
            {
                name: 'parse-int',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-int.js
                    var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
                    ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

                    return (
                        parseInt(ws + '08') === 8 &&
                        parseInt(ws + '0x16') === 22
                    );
                }
            },
            {
                name: 'parse-float',
                valid: function() {
                    var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
                    ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-float.js
                    return 1 / parseFloat(ws + '-0') === -Infinity;
                }
            },
            {
                name: 'promise',
                type: 'constructor',
                valid: function() {
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
            },
            {name: 'set', type: 'constructor'},
            {name: 'set-immediate'},
            {
                name: 'set-interval',
                valid: function() {
                    // faudrais check si y'a beosin de fix des truc sous IE9
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/web.timers.js
                    return true;
                }
            },
            {
                name: 'set-timeout',
                valid: function() {
                    // same as above
                    return true;
                }
            },
            {name: 'url', path: 'URL'},
            {name: 'url-search-params', path: 'URLSearchParams'},
            {name: 'weak-map', type: 'constructor'},
            {name: 'weak-set', type: 'constructor'},

            {name: 'array-buffer', type: 'constructor'},
            {name: 'data-view', type: 'constructor'},
            {name: 'int8-array', type: 'constructor'},
            {name: 'uint8-array', type: 'constructor'},
            {name: 'uint8-clamped-array', type: 'constructor'},
            {name: 'int16-array', type: 'constructor'},
            {name: 'uint16-array', type: 'constructor'},
            {name: 'int32-array', type: 'constructor'},
            {name: 'uint32-array', type: 'constructor'},
            {name: 'float32-array', type: 'constructor'},
            {name: 'float64-array', type: 'constructor'}
        );
        function validDomCollectionIteration() {
            return function() {
                return false;
            };
            // return function(domCollection) {
            //     if (jsenv.isBrowser()) {
            //         return combine(
            //             method(domCollection),
            //             method(domCollection + '.keys'),
            //             method(domCollection + '.values'),
            //             method(domCollection + '.entries'),
            //             method(domCollection + '[Symbol.iterator]')
            //         ).valid;
            //     }
            //     return false;
            // };
        }
        if (jsenv.isBrowser()) {
            registerStandardFeatures('global',
                {
                    name: 'node-list-iteration',
                    path: 'NodeList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'dom-token-list-iteration',
                    path: 'DOMTokenList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'media-list-iteration',
                    path: 'MediaList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'style-sheet-list-iteration',
                    path: 'StyleSheetList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'css-rule-list-iteration',
                    path: 'CSSRuleList',
                    valid: validDomCollectionIteration()
                }
            );
        }

        // map, join, filter y'a surement des fix, il ne suffit pas de vérifier que la méthode existe
        registerStandardFeatures('array',
            {name: 'copy-within', path: autoPrototype},
            {name: 'every', path: autoPrototype},
            {name: 'find', path: autoPrototype},
            {name: 'find-index', path: autoPrototype},
            {name: 'fill', path: autoPrototype},
            {name: 'filter', path: autoPrototype},
            {name: 'for-each', path: autoPrototype},
            {name: 'from'},
            {name: 'index-of', path: autoPrototype},
            {name: 'iterator', path: 'Array.prototype[Symbol.iterator]'},
            {name: 'is-array'},
            {name: 'join', path: autoPrototype},
            {name: 'last-index-of', path: autoPrototype},
            {name: 'map', path: autoPrototype},
            {name: 'of'},
            {name: 'reduce', path: autoPrototype},
            {name: 'reduce-right', path: autoPrototype},
            {name: 'slice', path: autoPrototype},
            {name: 'some', path: autoPrototype},
            {name: 'sort', path: autoPrototype}
            // ['species', '???', auto]
        );

        registerStandardFeatures('date',
            {name: 'now'},
            {
                name: 'to-iso-string',
                path: 'Date.prototype.toISOString',
                valid: Predicate.every(
                    function() {
                        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
                        return new Date(-5e13 - 1).toISOString() === '0385-07-25T07:06:39.999Z';
                    },
                    Predicate.fails(function() {
                        // eslint-disable-next-line no-unused-expressions
                        new Date(NaN).toISOString();
                    })
                )
            },
            {
                name: 'to-json',
                path: 'Date.prototype.toJSON',
                valid: Predicate.every(
                    function() {
                        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
                        return new Date(NaN).toJSON() === null;
                    },
                    function() {
                        var fakeDate = {
                            toISOString: function() {
                                return 1;
                            }
                        };
                        return Date.prototype.toJSON.call(fakeDate) === 1;
                    }
                )
            },
            {name: 'to-primitive', path: 'Date.prototype[Symbol.toPrimitive]'},
            {
                name: 'to-string',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
                    return new Date(NaN).toString() === 'Invalid Date';
                }
            }
        );

        registerStandardFeatures('function',
            {name: 'bind', path: autoPrototype},
            {name: 'name', path: autoPrototype},
            {name: 'has-instance', path: 'Function.prototype[Symbol.hasInstance]'}
        );

        registerStandardFeatures('object',
            {name: 'assign'},
            {name: 'create'},
            {name: 'define-getter', path: 'Object.__defineGetter__', spec: 'es7'},
            {name: 'define-property'},
            {name: 'define-properties', spec: 'es7'},
            {name: 'define-setter', path: 'Object.__defineSetter__', spec: 'es7'},
            {name: 'entries', spec: 'es7'},
            {name: 'freeze'},
            {name: 'get-own-property-descriptor'},
            {name: 'get-own-property-descriptors', spec: 'es7'},
            {name: 'get-own-property-names'},
            {name: 'get-prototype-of'},
            {name: 'is'},
            {name: 'is-extensible'},
            {name: 'is-frozen'},
            {name: 'is-sealed'},
            {name: 'lookup-getter', path: 'Object.__lookupGetter__', spec: 'es7'},
            {name: 'lookup-setter', path: 'Object.__lookupSetter__', spec: 'es7'},
            {name: 'prevent-extensions'},
            {name: 'seal'},
            {name: 'set-prototype-of'},
            {
                name: 'to-string',
                valid: function() {
                    // si on a pas Symbol.toStringTag
                    // https://github.com/zloirock/core-js/blob/master/modules/es6.object.to-string.js
                    var test = {};
                    test[Symbol.toStringTag] = 'z';
                    return test.toString() === '[object z]';
                }
            },
            {name: 'values', spec: 'es7'}
        );

        registerStandardFeatures('symbol',
            {name: ''},
            {name: 'async-iterator', spec: 'es7'},
            {name: 'has-instance'},
            {name: 'iterator'},
            {name: 'match'},
            {name: 'observable', spec: 'es7'},
            {name: 'replace'},
            {name: 'search'},
            {name: 'split'},
            {name: 'to-primitive'}
        );

        registerStandardFeatures('math',
            {name: 'acosh'},
            {name: 'asinh'},
            {name: 'atanh'},
            {name: 'cbrt'},
            {name: 'clamp', spec: 'es7'},
            {name: 'clz32'},
            {name: 'cosh'},
            {name: 'deg-per-rad', path: 'Math.DEG_PER_RAD', spec: 'es7'},
            {name: 'degrees', spec: 'es7'},
            {name: 'expm1'},
            {name: 'fround'},
            {name: 'fscale', spec: 'es7'},
            {name: 'hypot'},
            {name: 'iaddh', spec: 'es7'},
            {name: 'imul'},
            {name: 'imulh', spec: 'es7'},
            {name: 'isubh', spec: 'es7'},
            {name: 'log10'},
            {name: 'log1p'},
            {name: 'log2'},
            {name: 'radians', spec: 'es7'},
            {name: 'rad-per-deg', path: 'Math.RAD_PER_DEG', spec: 'es7'},
            {name: 'scale', spec: 'es7'},
            {name: 'sign'},
            {name: 'sinh'},
            {name: 'tanh'},
            {name: 'trunc'},
            {name: 'umulh', spec: 'es7'}
        );

        registerStandardFeatures('number',
            {
                name: 'constructor',
                path: 'Number',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.number.constructor.js#L46
                    return (
                        Number(' 0o1') &&
                        Number('0b1') &&
                        !Number('+0x1')
                    );
                }
            },
            {name: 'epsilon', path: 'Number.EPSILON'},
            {name: 'is-finite'},
            {name: 'is-integer'},
            {name: 'is-nan', path: 'Number.isNaN'},
            {name: 'is-safe-integer'},
            {name: 'iterator', path: 'Number.prototype[Symbol.iterator]'},
            {name: 'max-safe-integer', path: 'Number.MAX_SAFE_INTEGER'},
            {name: 'min-safe-integer', path: 'Number.MIN_SAFE_INTEGER'},
            {name: 'to-fixed', path: autoPrototype},
            {name: 'parse-float'},
            {name: 'parse-int'}
        );

        registerStandardFeatures('reflect',
            {name: 'apply'},
            {name: 'construct'},
            {name: 'define-property'},
            {name: 'delete-property'},
            {name: 'enumerate'},
            {name: 'get'},
            {name: 'get-own-property-descriptor'},
            {name: 'get-prototype-of'},
            {name: 'has'},
            {name: 'own-keys'},
            {name: 'prevent-extensions'},
            {name: 'set'},
            {name: 'set-prototype-of'},

            {name: 'define-metadata', spec: 'es7'},
            {name: 'delete-metadata', spec: 'es7'},
            {name: 'get-metadata', spec: 'es7'},
            {name: 'get-metadata-keys', spec: 'es7'},
            {name: 'get-own-metadata', spec: 'es7'},
            {name: 'get-own-metadata-keys', spec: 'es7'},
            {name: 'has-metadata', spec: 'es7'},
            {name: 'has-own-metadata', spec: 'es7'},
            {name: 'metadata', spec: 'es7'}
        );

        registerStandardFeatures('regexp',
            {
                name: 'constructor',
                path: 'RegExp',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.constructor.js
                    var re1 = /a/g;
                    var re2 = /a/g;
                    re2[Symbol.match] = false;
                    var re3 = RegExp(re1, 'i');
                    return (
                        RegExp(re1) === re1 &&
                        RegExp(re2) !== re2 &&
                        RegExp(re3).toString() === '/a/i'
                    );
                }
            },
            {name: 'escape', path: 'RegExp.escape'},
            {
                name: 'flags',
                path: 'RegExp.prototype.flags',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.flags.js
                    return /./g.flags === 'g';
                }
            },
            {name: 'match', path: 'RegExp.prototype[Symbol.match]'},
            {name: 'replace', path: 'RegExp.prototype[Symbol.replace]'},
            {name: 'search', path: 'RegExp.prototype[Symbol.search]'},
            {name: 'split', path: 'RegExp.prototype[Symbol.split]'},
            {
                name: 'to-string',
                path: 'RegExp.prototype.toString',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/master/modules/es6.regexp.to-string.js
                    var toString = RegExp.prototype.toString;
                    return (
                        toString.call({source: 'a', flags: 'b'}) === '/a/b' &&
                        toString.name === 'toString'
                    );
                }
            }
        );

        registerStandardFeatures('string',
            {name: 'at', path: autoPrototype, spec: 'es7'},
            {name: 'from-code-point'},
            {name: 'code-point-at', path: autoPrototype},
            {name: 'ends-with', path: autoPrototype},
            {name: 'escape-html'},
            {name: 'includes', path: autoPrototype},
            {name: 'iterator', path: 'String.prototype[Symbol.iterator]'},
            {name: 'match-all', path: 'String.prototype[Symbol.matchAll]', spec: 'es7'},
            {name: 'pad-end', path: autoPrototype, spec: 'es7'},
            {name: 'pad-start', path: autoPrototype, spec: 'es7'},
            {name: 'raw'},
            {name: 'repeat', path: autoPrototype},
            {name: 'starts-with', path: autoPrototype},
            {name: 'trim', path: autoPrototype},
            {name: 'trim-end', path: autoPrototype},
            {name: 'trim-start', path: autoPrototype},
            {name: 'unescape-html'},

            {name: 'anchor', path: autoPrototype},
            {name: 'big', path: autoPrototype},
            {name: 'blink', path: autoPrototype},
            {name: 'fixed', path: autoPrototype},
            {name: 'fontcolor', path: autoPrototype},
            {name: 'fontsize', path: autoPrototype},
            {name: 'italics', path: autoPrototype},
            {name: 'link', path: autoPrototype},
            {name: 'small', path: autoPrototype},
            {name: 'strike', path: autoPrototype},
            {name: 'sub', path: autoPrototype},
            {name: 'sup', path: autoPrototype}
        );
        */
    });

    jsenv.build(function registerSyntaxFeatures() {
        /*
        this is all about mapping
        https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
        with
        https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
        https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js
        */

        var registerSyntaxFeature = function() {};
        var testSyntax = function() {};
        var extract = function() {};

        /*
        registerSyntaxFeature('arrow-functions', testSyntax(
            {
                name: '0 parameters',
                code: '() => 5',
                valid: function(fn) {
                    return fn === 5;
                }
            },
            {
                name: 'lexical "super" binding in constructors',
                relyOn: ['class'], // no need to check this if we don't use class
                code: '\
                    var scope = {};\
                    class B {\
                      constructor (arg) {\
                        scope.received = arg;\
                      }\
                    }\
                    \
                    class C extends B {\
                      constructor (arg) {\
                        var callSuper = () => super(arg);\
                        callSuper();\
                      }\
                    }\
                    scope;\
                ',
                valid: function(scope) {
                    return (
                        new scope.C('foo') instanceof scope.C &&
                        scope.received === 'foo'
                    );
                }
            }
        ));
        registerSyntaxFeature('block-level-function-declaration', testSyntax(
            {
                code: extract(function() {
                    'use strict';
                    if (f() !== 1) return false;
                    function f() { return 1; }
                    {
                      if (f() !== 2) return false;
                      function f() { return 2; }
                      if (f() !== 2) return false;
                    }
                    if (f() !== 1) return false;
                    return true;
                })
            }
        ));
        */

        registerSyntaxFeature('const', testSyntax(
            {
                name: 'basic support',
                code: 'const foo = 123; foo;',
                valid: function(foo) {
                    return foo === 123;
                }
            },
            {
                name: 'block-scoped',
                code: 'const bar = 123; { const bar = 456; } bar;',
                valid: function(bar) {
                    return bar === 123;
                }
            },
            {
                name: 'cannot be in statements',
                code: extract(function() {/*
                    const bar = 1;
                    try {
                      Function("if(true) const baz = 1;")();
                    } catch(e) {
                      return true;
                    }
                */})
            },
            {
                name: 'redefining a const is an error',
                code: extract(function() {/*
                    const baz = 1;
                    try {
                      Function("const foo = 1; foo = 2;")();
                    } catch(e) {
                      return true;
                    }
                */})
            },
            {
                name: 'for loop statement scope',
                code: 'const baz = 1; for(const baz = 0; false;) {}; baz;',
                valid: function(baz) {
                    return baz === 1;
                }
            },
            {
                name: 'for-in loop iteration scope',
                code: extract(function() {/*
                    var scopes = [];
                    for(const i in { a:1, b:1 }) {
                      scopes.push(function(){ return i; });
                    }
                    scopes;
                */}),
                valid: function(scopes) {
                    return (
                        scopes[0]() === "a" &&
                        scopes[1]() === "b"
                    );
                }
            },
            {
                name: 'for-of loop iteration scope',
                code: extract(function() {/*
                    var scopes = [];
                    for(const i of ['a','b']) {
                      scopes.push(function(){ return i; });
                    }
                    scopes;
                */}),
                valid: function(scopes) {
                    return (
                        scopes[0]() === "a" &&
                        scopes[1]() === "b"
                    );
                }
            },
            {
                name: 'temporal dead zone',
                code: extract(function() {/*
                    var passed = (function(){ try { qux; } catch(e) { return true; }}());
                    function fn() { passed &= qux === 456; }
                    const qux = 456;
                    fn();
                    return passed;
                */})
            }
        ));
        registerSyntaxFeature('let', testSyntax(
            {
                name: 'basic support',
                code: 'let foo = 123; foo;',
                valid: function(foo) {
                    return foo === 123;
                }
            },
            {
                name: 'is block-scoped',
                code: 'let bar = 123; { let bar = 456; } bar;',
                valid: function(bar) {
                    return bar === 123;
                }
            },
            {
                name: 'cannot be in statements',
                code: extract(function() {/*
                    let bar = 1;
                    try {
                      Function("if(true) let baz = 1;")();
                    } catch(e) {
                      return true;
                    }
                */})
            },
            {
                name: 'for loop statement scope',
                code: 'let baz = 1; for(let baz = 0; false;) {}; baz;',
                valid: function(baz) {
                    return baz === 1;
                }
            },
            {
                name: 'temporal dead zone',
                code: extract(function() {/*
                    var passed = (function(){ try {  qux; } catch(e) { return true; }}());
                    function fn() { passed &= qux === 456; }
                    let qux = 456;
                    fn();
                    return passed;
                */})
            },
            {
                name: 'for/for-in loop iteration scope',
                code: extract(function() {/*
                    let scopes = [];
                    for(let i = 0; i < 2; i++) {
                      scopes.push(function(){ return i; });
                    }
                    for(let i in { a:1, b:1 }) {
                      scopes.push(function(){ return i; });
                    }
                    return scopes;
                */}),
                valid: function(scopes) {
                    return (
                        scopes[0]() === 0 &&
                        scopes[1]() === 1 &&
                        scopes[2]() === 'a' &&
                        scopes[3]() === 'b'
                    );
                }
            }
        ));
    });

    jsenv.build(function registerStandardFeatures() {
        var implementation = jsenv.implementation;
        var noValue = {novalue: true};

        function registerStandard(globalValue) {
            var feature = implementation.createFeature();

            feature.name = 'global';
            feature.type = 'standard';
            feature.test = presence;
            feature.value = globalValue;
            feature.ensure = function(descriptor) {
                var dependent = implementation.createFeature();

                dependent.parent = this;
                dependent.type = this.type;
                dependent.ensure = this.ensure;
                dependent.valueGetter = feature.valueGetter;
                dependent.relyOn(this);

                var descriptorName;
                var descriptorPath;
                var descriptorKind;
                var descriptorTest;
                if ('name' in descriptor) {
                    descriptorName = descriptor.name;
                }
                if ('test' in descriptor) {
                    descriptorTest = descriptor.test;
                }
                if ('kind' in descriptor) {
                    descriptorKind = descriptor.kind;
                }
                if ('path' in descriptor) {
                    descriptorPath = descriptor.path;
                    if (isFeature(descriptorPath)) {
                        var dependency = descriptorPath;
                        descriptorPath = 'dynamic';// this.parent.path + '[' + dependency.path + ']';
                        dependent.relyOn(dependency);
                        if (!descriptorName) {
                            descriptorName = dependency.name;
                        }
                        dependent.valueGetter = function() {
                            var fromValue = this.parent.value;
                            var dependencyValue = dependency.value;

                            if (dependencyValue in fromValue) {
                                return fromValue[dependencyValue];
                            }
                            return noValue;
                        };
                    } else if (typeof descriptorPath === 'string') {
                        if (!descriptorName) {
                            descriptorName = camelToHyphen(descriptorPath);
                        }
                    }
                }

                if (this === feature) {
                    dependent.name = descriptorName;
                } else {
                    dependent.name = this.name + '-' + descriptorName;
                }

                if (descriptorPath) {
                    dependent.path = descriptorPath;
                }

                var tests = [];
                if (descriptorPath) {
                    tests.push(presence);
                }
                if (descriptorKind) {
                    tests.push(ensureKind(descriptorKind));
                }
                if (descriptorTest) {
                    tests.push(function(settle) {
                        if (descriptorTest.length === 0) {
                            var returnValue = descriptorTest.call(this);
                            settle(Boolean(returnValue), returnValue ? 'passed' : 'failed', returnValue);
                        } else {
                            descriptorTest.call(this, function(valid, reason, detail) {
                                settle(valid, reason || valid ? 'passed' : 'failed', detail);
                            });
                        }
                    });
                }
                if (tests.length > 0) {
                    if (tests.length === 1) {
                        dependent.test = tests[0];
                    } else {
                        dependent.test = function(settle) {
                            var i = 0;
                            var j = tests.length;
                            var statusValid;
                            var statusReason;
                            var statusDetail;
                            var handledCount = 0;

                            function compositeSettle(valid, reason, detail) {
                                handledCount++;

                                statusValid = valid;
                                statusReason = reason;
                                statusDetail = detail;

                                var settled = false;
                                if (statusValid) {
                                    settled = handledCount === j;
                                } else {
                                    settled = true;
                                }

                                if (settled) {
                                    settle(statusValid, statusReason, statusDetail);
                                }
                            }

                            while (i < j) {
                                var test = tests[i];
                                if (test.length === 0) {
                                    var returnValue = test.call(this);
                                    compositeSettle(Boolean(returnValue), 'returned', returnValue);
                                } else {
                                    test.call(this, compositeSettle);
                                }
                                if (statusValid === false) {
                                    break;
                                }
                                i++;
                            }
                        };
                    }
                }

                implementation.add(dependent);
                return dependent;
            };

            function isFeature(value) {
                return typeof value === 'object';
            }
            function camelToHyphen(string) {
                var i = 0;
                var j = string.length;
                var camelizedResult = '';
                while (i < j) {
                    var letter = string[i];
                    var action;

                    if (i === 0) {
                        action = 'lower';
                    } else if (isUpperCaseLetter(letter)) {
                        if (isUpperCaseLetter(string[i - 1])) { // toISOString -> to-iso-string & toJSON -> to-json
                            if (i === j - 1) { // toJSON last letter
                                action = 'camelize';
                            } else if (isLowerCaseLetter(string[i + 1])) { // toISOString on the S
                                action = 'camelize';
                            } else { // toJSON on the SON
                                action = 'lower';
                            }
                        } else if (
                            isLowerCaseLetter(string[i - 1]) &&
                            i > 1 &&
                            isUpperCaseLetter(string[i - 2])
                        ) { // isNaN -> is-nan
                            action = 'lower';
                        } else {
                            action = 'camelize';
                        }
                    } else {
                        action = 'concat';
                    }

                    if (action === 'lower') {
                        camelizedResult += letter.toLowerCase();
                    } else if (action === 'camelize') {
                        camelizedResult += '-' + letter.toLowerCase();
                    } else if (action === 'concat') {
                        camelizedResult += letter;
                    } else {
                        throw new Error('unknown camelize action');
                    }

                    i++;
                }
                return camelizedResult;
            }
            function isUpperCaseLetter(letter) {
                return /[A-Z]/.test(letter);
            }
            function isLowerCaseLetter(letter) {
                return /[a-z]/.test(letter);
            }

            feature.valueGetter = function() {
                var endValue;

                if (this === feature) {
                    endValue = globalValue;
                } else {
                    var path = this.path;
                    var parts = path.split('.');
                    var startValue = this.parent.value;
                    endValue = startValue;
                    var i = 0;
                    var j = parts.length;
                    while (i < j) {
                        var part = parts[i];
                        if (part in endValue) {
                            endValue = endValue[part];
                        } else {
                            endValue = noValue;
                            break;
                        }
                        i++;
                    }
                }

                return endValue;
            };
            function presence(settle) {
                var value = this.valueGetter();
                if (value === noValue) {
                    settle(false, 'missing');
                } else {
                    this.value = value;
                    settle(true, 'present', value);
                }
            }
            function ensureKind(expectedKind) {
                return function(settle) {
                    var value = this.value;
                    var actualKind;

                    if (expectedKind === 'object' && value === null) {
                        actualKind = 'null';
                    } else if (expectedKind === 'symbol') {
                        if (value && value.constructor === Symbol) {
                            actualKind = 'symbol';
                        } else {
                            actualKind = typeof value;
                        }
                    } else {
                        actualKind = typeof value;
                    }

                    if (actualKind === expectedKind) {
                        settle(true, 'expected-' + actualKind, value);
                    } else {
                        settle(false, 'unexpected-' + actualKind, value);
                    }
                };
            }
            implementation.add(feature);
            return feature;
        }

        var globalStandard = registerStandard(jsenv.global);

        var PromiseStandard = globalStandard.ensure({
            path: 'Promise'
        });
        PromiseStandard.ensure({
            name: 'unhandled-rejection',
            test: function(settle) {
                var promiseRejectionEvent;
                var unhandledRejection = function(e) {
                    promiseRejectionEvent = e;
                };

                if (jsenv.isBrowser()) {
                    if ('onunhandledrejection' in window === false) {
                        return settle(false);
                    }
                    window.onunhandledrejection = unhandledRejection;
                } else if (jsenv.isNode()) {
                    process.on('unhandledRejection', unhandledRejection);
                } else {
                    return settle(false);
                }

                var promise = Promise.reject('foo');
                setTimeout(function() {
                    settle(
                        promiseRejectionEvent &&
                        promiseRejectionEvent.promise === promise &&
                        promiseRejectionEvent.reason === 'foo'
                    );
                }, 10); // engine has 10ms to trigger the event
            }
        });
        PromiseStandard.ensure({
            name: 'rejection-handled',
            test: function(settle) {
                var promiseRejectionEvent;
                var rejectionHandled = function(e) {
                    promiseRejectionEvent = e;
                };

                if (jsenv.isBrowser()) {
                    if ('onrejectionhandled' in window === false) {
                        return settle(false);
                    }
                    window.onrejectionhandled = rejectionHandled;
                } else if (jsenv.isNode()) {
                    process.on('rejectionHandled', rejectionHandled);
                } else {
                    return settle(false);
                }

                var promise = Promise.reject('foo');
                setTimeout(function() {
                    promise.catch(function() {});
                    setTimeout(function() {
                        settle(
                            promiseRejectionEvent &&
                            promiseRejectionEvent.promise === promise &&
                            promiseRejectionEvent.reason === 'foo'
                        );
                    }, 10); // engine has 10ms to trigger the event
                });
            }
        });

        var SymbolStandard = globalStandard.ensure({
            path: 'Symbol'
        });
        SymbolStandard.ensure({
            path: 'toPrimitive'
        });

        var ObjectStandard = globalStandard.ensure({
            path: 'Object'
        });
        ObjectStandard.ensure({
            path: 'getOwnPropertyDescriptor'
        });

        var DateStandard = globalStandard.ensure({
            path: 'Date'
        });
        DateStandard.ensure({
            path: 'now'
        });
        var DatePrototypeStandard = DateStandard.ensure({
            path: 'prototype'
        });
        DatePrototypeStandard.ensure({
            path: 'toISOString',
            test: Predicate.every(
                function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
                    return new Date(-5e13 - 1).toISOString() === '0385-07-25T07:06:39.999Z';
                },
                Predicate.fails(function() {
                    // eslint-disable-next-line no-unused-expressions
                    new Date(NaN).toISOString();
                })
            )
        });
        DatePrototypeStandard.ensure({
            path: 'toJSON',
            test: Predicate.every(
                function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
                    return new Date(NaN).toJSON() === null;
                },
                function() {
                    var fakeDate = {
                        toISOString: function() {
                            return 1;
                        }
                    };
                    return Date.prototype.toJSON.call(fakeDate) === 1;
                }
            )
        });
        DatePrototypeStandard.ensure({
            path: implementation.get('symbol-to-primitive')
        });
        DatePrototypeStandard.ensure({
            path: 'toString',
            test: function() {
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
                return new Date(NaN).toString() === 'Invalid Date';
            }
        });

        /*
        if (jsenv.isBrowser() === false) {
            implementation.exclude('node-list');
            // etc
            // en gros on exclu certains features quand on est pas dans le browser
        }
        */
    });

    jsenv.build(function registerSyntaxFeatures() {
        var implementation = jsenv.implementation;

        function syntax(firstArg, codeReturnValueTest) {
            var code;
            if (typeof firstArg === 'function') {
                code = firstArg.toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
            } else if (typeof firstArg === 'string') {
                code = firstArg;
            } else {
                throw new TypeError('syntax first argument must be a string or a function');
            }

            return function(settle) {
                var returnValue = eval(code); // eslint-disable-line

                if (codeReturnValueTest) {
                    if (codeReturnValueTest.length < 2) {
                        returnValue = codeReturnValueTest.call(this, returnValue);
                        settle(Boolean(returnValue), 'returned', returnValue);
                    } else {
                        codeReturnValueTest.call(this, returnValue, settle);
                    }
                } else {
                    settle(Boolean(returnValue), 'returned', returnValue);
                }
            };
        }
        function registerSyntax(syntaxDescriptor) {
            var feature = implementation.createFeature();

            feature.name = syntaxDescriptor.name;
            feature.type = 'syntax';
            feature.test = syntaxDescriptor.test;
            feature.ensure = function(syntaxDescriptor) {
                var dependent = implementation.createFeature();

                dependent.relyOn(this);
                dependent.parent = this;
                dependent.type = this.type;

                if ('name' in syntaxDescriptor) {
                    dependent.name = this.name + '-' + syntaxDescriptor.name;
                }
                if ('dependencies' in syntaxDescriptor) {
                    Iterable.forEach(syntaxDescriptor.dependencies, function(dependencyName) { // eslint-disable-line
                        dependent.relyOn(dependencyName);
                    });
                }
                if ('test' in syntaxDescriptor) {
                    dependent.test = syntaxDescriptor.test;
                }

                implementation.add(dependent);
                return dependent;
            };
            implementation.add(feature);
            return feature;
        }

        var constSyntax = registerSyntax({
            name: 'const',
            test: syntax(
                'const foo = 123; foo;',
                function(foo) {
                    return foo === 123;
                }
            )
        }).exclude();
        constSyntax.ensure({
            name: 'scoped-for-of',
            // dependencies: ['for-of'],
            test: syntax(
                function() {/*
                    var scopes = [];
                    for(const i of ['a','b']) {
                      scopes.push(function(){ return i; });
                    }
                    scopes;
                */},
                function(scopes) {
                    return (
                        scopes[0]() === "a" &&
                        scopes[1]() === "b"
                    );
                }
            )
        }).exclude();
    });

    jsenv.build(function implementationRequired() {
        // on pourrait imaginer authoriser des requirements avec des versions object-assign@1.0
        // voir même des arguments (eslint ou babel le permettent par ex)

        var implementation = this.implementation;

        implementation.include = function(featureName) {
            implementation.get(featureName).include();
        };
        implementation.exclude = function(featureName, reason) {
            implementation.get(featureName).exclude(reason);
        };

        function groupNodesByDependencyDepth(nodes) {
            var unresolvedNodes = nodes.slice();
            var i = 0;
            var j = unresolvedNodes.length;
            var resolvedNodes = [];
            var groups = [];
            var group;

            while (true) { // eslint-disable-line
                group = [];
                i = 0;
                while (i < j) {
                    var unresolvedNode = unresolvedNodes[i];
                    var everyDependencyIsResolved = Iterable.every(unresolvedNode.dependencies, function(dependency) {
                        return Iterable.includes(resolvedNodes, dependency);
                    });
                    if (everyDependencyIsResolved) {
                        group.push(unresolvedNode);
                        unresolvedNodes.splice(i, 1);
                        j--;
                    } else {
                        i++;
                    }
                }

                if (group.length) {
                    groups.push(group);
                    resolvedNodes.push.apply(resolvedNodes, group);
                } else {
                    break;
                }
            }

            return groups;
        }

        implementation.groupFeatures = function(callback) {
            var inclusionHalf = Iterable.bisect(implementation.features, function(feature) {
                return feature.isExcluded();
            });
            var excludedFeatures = inclusionHalf[0];
            var includedFeatures = inclusionHalf[1];
            var groups = groupNodesByDependencyDepth(includedFeatures);
            var groupIndex = -1;
            var groupCount = groups.length;
            var done = function() {
                var validHalf = Iterable.bisect(includedFeatures, function(feature) {
                    return feature.isValid();
                });
                callback({
                    excluded: excludedFeatures,
                    included: includedFeatures,
                    includedAndGroupedByDependencyDepth: groups,
                    includedAndValid: validHalf[0],
                    includedAndInvalid: validHalf[1]
                });
            };

            function nextGroup() {
                groupIndex++;
                if (groupIndex === groupCount) {
                    // il faut faire setTimeout sur done
                    // je ne sais pas trop pourquoi sinon nodejs cache les erreurs qui pourraient
                    // être throw par done ou le callback
                    setTimeout(done);
                } else {
                    var group = groups[groupIndex];
                    var i = 0;
                    var j = group.length;
                    var readyCount = 0;

                    while (i < j) {
                        var feature = group[i];
                        feature.updateStatus(function() { // eslint-disable-line
                            readyCount++;
                            if (readyCount === j) {
                                nextGroup();
                            }
                        });
                        i++;
                    }
                }
            }
            nextGroup();
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
