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
                } else if (Version.isPrototypeOf(firstArg)) {
                    version = firstArg;
                } else {
                    throw new Error('version.match expect a string or a version object');
                }
                return version;
            };

            Version.prototype = {
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

    jsenv.build(function implementation() {
        var implementation = {};
        implementation.features = [];

        implementation.add = function(featureName, featureVersion) {
            featureVersion = featureVersion || '*';

            var existingFeature = this.get(featureName, featureVersion);
            if (existingFeature) {
                throw new Error('The feature ' + existingFeature + ' already exists');
            }
            var versionnedFeature = new VersionnedFeature(featureName, featureVersion);
            this.features.push(versionnedFeature);
            return versionnedFeature;
        };
        implementation.get = function(featureName, featureVersion) {
            featureVersion = featureVersion || '*';

            var foundVersionnedFeature = find(this.features, function(versionnedFeature) {
                return (
                    versionnedFeature.name === featureName &&
                    versionnedFeature.version.match(featureVersion)
                );
            });
            return foundVersionnedFeature;
        };
        implementation.support = function() {
            var versionnedFeature = this.get.apply(this, arguments);
            if (versionnedFeature) {
                return versionnedFeature.test();
            }
            return false;
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

        var env = this;
        function VersionnedFeature(name, version) {
            this.name = name;
            this.version = env.createVersion(version);
            this.branches = [];
        }
        var VersionnedFeaturePrototype = VersionnedFeature.prototype;
        VersionnedFeaturePrototype.toString = function() {
            return this.name + '@' + this.version;
        };
        VersionnedFeaturePrototype.getStatus = function() {
            var branches = this.branches;
            var i = 0;
            var j = branches.length;
            var status = 'valid';

            while (i < j) {
                var branch = branches[i];
                try {
                    if (branch.condition.call(this)) {
                        status = branch.status;
                    }
                } catch (e) {
                    status = 'errored';
                }
                i++;
            }

            return status;
        };
        VersionnedFeaturePrototype.when = function(condition, status) {
            this.branches.push({
                condition: condition,
                status: status
            });
            return this;
        };
        VersionnedFeaturePrototype.test = function() {
            return this.getStatus() === 'valid';
        };

        return {
            implementation: implementation
        };
    });

    jsenv.build(function readAt() {
        function readAt(object, path) {
            return createGetter(path)(object);
        }

        var noValue = {noValue: true};
        function createGetter(path) {
            var targets = parsePath(path);
            var getter = function(object) {
                var j = targets.length;
                var value = object;
                if (j > 0) {
                    var i = 0;
                    var target = targets[i];
                    i++;
                    value = readPath(object, target.properties);
                    if (value !== noValue) {
                        while (i < j) {
                            target = targets[i];
                            var otherValue = readPath(object, target.properties);
                            if (otherValue in value) {
                                value = value[otherValue];
                            } else {
                                value = noValue;
                                break;
                            }
                            i++;
                        }
                    }
                }
                return value;
            };

            return getter;
        }

        var cache = {};
        function parsePath(path) {
            var targets;

            if (path in cache) {
                targets = cache[path];
            } else {
                targets = parse(path);
                cache[path] = targets;
            }
            return targets;
        }

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

        function parse(path) {
            return propertyAccessParser.parse(path);
        }

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

        return {
            readAt: readAt,
            noValue: noValue
        };
    });

    jsenv.build(function makeImplementationScannable() {
        // y'auras aussi besoin de détecter certain truc qu'on transpile
        // https://github.com/75lb/feature-detect-es6/blob/master/lib/feature-detect-es6.js

        /*
        ça pourrait être pas mal aussi une api comme
        registerAndPolyfill('global',
            method('setImmediate'),
            method({name: 'parseInt', test: function() {}}),
            constructor({name: 'ArrayBuffer', polyfill: ''es6.typed.array-buffer''})
        );

        staticMethod()
        method()
        prototypeMethod()
        number()

        mais bon on va pas changer toutes les 2 seconde on reste sur ça pour le moment
        */

        var implementation = jsenv.implementation;
        var hyphenToCamel = jsenv.hyphenToCamel;
        var readAt = jsenv.readAt;
        var noValue = jsenv.noValue;
        var autoPrototype = {};
        var registerNativeFeatures = function(targetName) {
            var i = 1;
            var j = arguments.length;
            var capitalizedTargetName = targetName[0].toUpperCase() + targetName.slice(1);
            var prefix = function(featureName) {
                if (targetName === 'global') {
                    return featureName;
                }
                if (featureName) {
                    return targetName + '-' + featureName;
                }
                return targetName;
            };

            while (i < j) {
                var featureDescriptor = arguments[i];

                var featureName;
                var featureDescriptorName;
                if ('name' in featureDescriptor) {
                    featureDescriptorName = featureDescriptor.name;
                    if (typeof featureDescriptorName === 'string') {
                        featureName = featureDescriptorName;
                    } else {
                        throw new TypeError('feature descriptor name must be a string');
                    }
                } else {
                    throw new Error('feature descriptor must have a name');
                }
                var prefixedFeatureName = prefix(featureName);

                var featurePath;
                var featureDescriptorPath;
                if ('path' in featureDescriptor) {
                    featureDescriptorPath = featureDescriptor.path;
                    if (typeof featureDescriptorPath === 'string') {
                        featurePath = featureDescriptorPath;
                    } else if (featureDescriptorPath === autoPrototype) {
                        featurePath = capitalizedTargetName;
                        featurePath += '.prototype';
                        if (featureName) {
                            featurePath += '.' + hyphenToCamel(featureName);
                        }
                    }
                } else {
                    if (targetName === 'global') {
                        featurePath = '';
                    } else {
                        featurePath = capitalizedTargetName;
                    }
                    if (featureName) {
                        if (featurePath.length) {
                            featurePath += '.';
                        }
                        if (featureDescriptor.type === 'constructor') {
                            featurePath += featureName[0].toUpperCase() + hyphenToCamel(featureName.slice(1));
                        } else {
                            featurePath += hyphenToCamel(featureName);
                        }
                    }
                }

                var featureInvalidTest;
                var featureDescriptorInvalid;
                if ('invalid' in featureDescriptor) {
                    featureDescriptorInvalid = featureDescriptor.invalid;
                    if (typeof featureDescriptorInvalid === 'function') {
                        featureInvalidTest = featureDescriptorInvalid;
                    } else {
                        throw new TypeError('feature descriptor invalid must be a function');
                    }
                } else {
                    featureInvalidTest = null;
                }

                var feature = implementation.add(prefixedFeatureName);
                feature.path = featurePath;
                feature.type = 'native';
                feature.spec = 'spec' in featureDescriptor ? featureDescriptor.spec : 'es6';
                feature.when(missing(), 'missing');
                if (featureInvalidTest) {
                    feature.when(featureInvalidTest, 'invalid');
                }

                i++;
            }
        };
        function missing() {
            return function() {
                return readAt(jsenv.global, this.path) === noValue;
            };
        }
        function some() {
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
        }
        // function every() {
        //     var predicates = arguments;
        //     var j = predicates.length;
        //     if (j === 0) {
        //         throw new Error('misisng arg to every');
        //     }
        //     return function() {
        //         var everyAreValid = true;
        //         var i = 0;
        //         while (i < j) {
        //             var predicate = predicates[i];
        //             if (!predicate.apply(this, arguments)) {
        //                 everyAreValid = false;
        //                 break;
        //             }
        //             i++;
        //         }
        //         return everyAreValid;
        //     };
        // }
        // jsenv.every = every;

        registerNativeFeatures('global',
            {name: 'asap', spec: 'es7'},
            {name: 'map', type: 'constructor'},
            {name: 'observable', type: 'constructor', spec: 'es7'},
            {
                name: 'parse-int',
                invalid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-int.js
                    var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
                    ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

                    return (
                        parseInt(ws + '08') !== 8 ||
                        parseInt(ws + '0x16') !== 22
                    );
                }
            },
            {
                name: 'parse-float',
                invalid: function() {
                    var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
                    ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-float.js
                    return 1 / parseFloat(ws + '-0') !== -Infinity;
                }
            },
            {
                name: 'promise',
                type: 'constructor',
                invalid: function() {
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
                invalid: function() {
                    // faudrais check si y'a beosin de fix des truc sous IE9
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/web.timers.js
                    return false;
                }
            },
            {
                name: 'set-timeout',
                invalid: function() {
                    // same as above
                    return false;
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
        function missingDomCollectionIteration() {
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
            registerNativeFeatures('global',
                {
                    name: 'node-list-iteration',
                    path: 'NodeList',
                    invalid: missingDomCollectionIteration()
                },
                {
                    name: 'dom-token-list-iteration',
                    path: 'DOMTokenList',
                    invalid: missingDomCollectionIteration()
                },
                {
                    name: 'media-list-iteration',
                    path: 'MediaList',
                    invalid: missingDomCollectionIteration()
                },
                {
                    name: 'style-sheet-list-iteration',
                    path: 'StyleSheetList',
                    invalid: missingDomCollectionIteration()
                },
                {
                    name: 'css-rule-list-iteration',
                    path: 'CSSRuleList',
                    invalid: missingDomCollectionIteration()
                }
            );
        }

        // map, join, filter y'a surement des fix, il ne suffit pas de vérifier que la méthode existe
        registerNativeFeatures('array',
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

        registerNativeFeatures('date',
            {name: 'now'},
            {
                name: 'to-iso-string',
                path: 'Date.prototype.toISOString',
                invalid: some(
                    function() {
                        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
                        try {
                            return new Date(-5e13 - 1).toISOString() !== '0385-07-25T07:06:39.999Z';
                        } catch (e) {
                            return true;
                        }
                    },
                    function() {
                        try {
                            // eslint-disable-next-line no-unused-expressions
                            new Date(NaN).toISOString();
                            return true;
                        } catch (e) {
                            return false;
                        }
                    }
                )
            },
            {
                name: 'to-json',
                path: 'Date.prototype.toJSON',
                invalid: some(
                    function() {
                        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
                        try {
                            return new Date(NaN).toJSON() !== null;
                        } catch (e) {
                            return false;
                        }
                    },
                    function() {
                        try {
                            var fakeDate = {
                                toISOString: function() {
                                    return 1;
                                }
                            };

                            return Date.prototype.toJSON.call(fakeDate) !== 1;
                        } catch (e) {
                            return false;
                        }
                    }
                )
            },
            {name: 'to-primitive', path: 'Date.prototype[Symbol.toPrimitive]'},
            {
                name: 'to-string',
                invalid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
                    return new Date(NaN).toString() !== 'Invalid Date';
                }
            }
        );

        registerNativeFeatures('function',
            {name: 'bind', path: autoPrototype},
            {name: 'name', path: autoPrototype},
            {name: 'has-instance', path: 'Function.prototype[Symbol.hasInstance]'}
        );

        registerNativeFeatures('object',
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
                invalid: function() {
                    // si on a pas Symbol.toStringTag
                    // https://github.com/zloirock/core-js/blob/master/modules/es6.object.to-string.js
                    var test = {};
                    test[Symbol.toStringTag] = 'z';
                    return test.toString() !== '[object z]';
                }
            },
            {name: 'values', spec: 'es7'}
        );

        registerNativeFeatures('symbol',
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

        registerNativeFeatures('math',
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

        registerNativeFeatures('number',
            {
                name: 'constructor',
                path: 'Number',
                invalid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.number.constructor.js#L46
                    return (
                        !Number(' 0o1') ||
                        !Number('0b1') ||
                        Number('+0x1')
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

        registerNativeFeatures('reflect',
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

        registerNativeFeatures('regexp',
            {
                name: 'constructor',
                path: 'RegExp',
                invalid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.constructor.js
                    var re1 = /a/g;
                    var re2 = /a/g;
                    re2[Symbol.match] = false;
                    var re3 = RegExp(re1, 'i');
                    return (
                        RegExp(re1) !== re1 ||
                        RegExp(re2) === re2 ||
                        RegExp(re3).toString() !== '/a/i'
                    );
                }
            },
            {name: 'escape', path: 'RegExp.escape'},
            {
                name: 'flags',
                path: 'RegExp.prototype.flags',
                invalid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.flags.js
                    return /./g.flags !== 'g';
                }
            },
            {name: 'match', path: 'RegExp.prototype[Symbol.match]'},
            {name: 'replace', path: 'RegExp.prototype[Symbol.replace]'},
            {name: 'search', path: 'RegExp.prototype[Symbol.search]'},
            {name: 'split', path: 'RegExp.prototype[Symbol.split]'},
            {
                name: 'to-string',
                path: 'RegExp.prototype.toString',
                invalid: function() {
                    // https://github.com/zloirock/core-js/blob/master/modules/es6.regexp.to-string.js
                    var toString = RegExp.prototype.toString;
                    return (
                        toString.call({source: 'a', flags: 'b'}) !== '/a/b' ||
                        toString.name !== 'toString'
                    );
                }
            }
        );

        registerNativeFeatures('string',
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
    });

    jsenv.build(function implementationRequired() {
        // on pourrait imaginer authoriser des requirements avec des versions object-assign@1.0
        // voir même des arguments (eslint ou babel le permettent par ex)

        var implementation = this.implementation;

        implementation.include = function(featureName) {
            implementation.get(featureName).excluded = false;
        };
        implementation.exclude = function(featureName, reason) {
            var feature = implementation.get(featureName);
            feature.excluded = true;
            feature.exclusionReason = reason;
        };

        implementation.getRequiredFeatures = function() {
            return implementation.features.filter(function(feature) {
                return feature.excluded !== true;
            }).filter(function(requiredFeature) {
                return requiredFeature.test() === false;
            });
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
