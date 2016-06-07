/* eslint-env browser, node */

/*
after including this file you can create your own env, (most time only one is enough)
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
            function Version(string) {
                var parts = String(string).split('.');
                var major = parts[0];
                var minor = parts[1];
                var patch = parts[2];

                this.major = parseInt(major);
                this.minor = minor ? parseInt(minor) : 0;
                this.patch = patch ? parseInt(patch) : 0;
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

            Version.prototype = {
                match: function(version) {
                    if (typeof version === 'string') {
                        version = new Version(version);
                    }

                    return compareVersionPart(this.patch, version.patch) &&
                        compareVersionPart(this.minor, version.minor) &&
                        compareVersionPart(this.major, version.major)
                    ;
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

            if (typeof window !== 'undefined') {
                if (window.MessageChannel) {
                    type = 'unknown'; // 'webworker';
                } else {
                    type = 'browser';
                }
            } else if (typeof process !== 'undefined' && {}.toString.call(process) === "[object process]") {
                // Don't get fooled by e.g. browserify environments.
                type = 'node';
                agent.setVersion(process.version.slice(1));
            } else {
                type = 'unknown';
            }

            agent.type = type;

            return {
                agent: agent,

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
                    if (/^[A-Z]:\/.*?$/.test(path)) {
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

        // build(function installGlobalMethod() {
        //     return {
        //         installGlobalMethod: function(globalName, method) {
        //             var handler = this.createCancellableAssignment(this.global, globalName);
        //             handler.assign(method);
        //             // give a way to restore previous global state thanks to globalValueHandler
        //             return handler;
        //         }
        //     };
        // });

        build(function support() {
            var detectors = {};

            return {
                support: function(name) {
                    return Boolean(detectors[name].call(this));
                },

                defineSupportDetector: function(name, detectMethod) {
                    detectors[name] = detectMethod;
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

        build(function supportDetectors() {
            var defineSupportDetector = jsenv.defineSupportDetector.bind(jsenv);

            function createPropertyDetector(property, object) {
                property = jsenv.hyphenToCamel(property);

                return function() {
                    return property in object;
                };
            }

            function defineEveryPropertyDetector(properties, object, name) {
                var i = properties.length;
                while (i--) {
                    var property = properties[i];
                    var detectorName;
                    if (name) {
                        detectorName = name + '-' + property;
                    } else {
                        detectorName = property;
                    }
                    defineSupportDetector(detectorName, createPropertyDetector(property, object));
                }
            }

            // global
            defineEveryPropertyDetector([
                'array-buffer',
                'data-view',
                'iterator',
                'map',
                'promise',
                'set',
                'set-immediate',
                'symbol',
                'url',
                'url-search-params',
                'weak-map',
                'reflect'
            ], this.global);

            // array
            defineEveryPropertyDetector([
                'from',
                'of',
                'is-array'
            ], Array, 'array');
            defineEveryPropertyDetector([
                'fill',
                'find',
                'find-index',
                'values',
                'keys',
                'entries',
                'every',
                'some'
            ], Array.prototype, 'array');

            // object
            defineEveryPropertyDetector([
                'assign',
                'create',
                'is'
            ], Object, 'object');

            // string
            defineEveryPropertyDetector([
                'trim',
                'includes',
                'repeat',
                'ends-with',
                'starts-with'
            ], String.prototype, 'string');

            // function
            defineEveryPropertyDetector([
                'bind'
            ], Function.prototype, 'function');

            // other detectors
            (function() {
                function createIteratorDetector(object) {
                    return function() {
                        return Symbol in this.global && Symbol.iterator in object;
                    };
                }

                defineSupportDetector('string-iterator', createIteratorDetector(String.prototype));
                defineSupportDetector('array-iterator', createIteratorDetector(Array.prototype));
                defineSupportDetector('number-iterator', createIteratorDetector(Number.prototype));
            })();
            defineSupportDetector('descriptor', function() {
                return 'defineProperty' in Object;
            });

            // property detector overrides
            defineSupportDetector('promise', function() {
                if (('Promise' in this.global) === false) {
                    return false;
                }
                if (Promise.isPolyfill) {
                    return true;
                }
                // agent must implement onunhandledrejection to consider promise implementation valid
                if (this.isBrowser()) {
                    if ('onunhandledrejection' in this.global) {
                        return true;
                    }
                    return false;
                }
                if (this.isNode()) {
                    // node version > 0.12.0 got the unhandledRejection hook
                    // this way to detect feature is AWFUL but for now let's do this
                    if (this.agent.version.major > 0 || this.agent.version.minor > 12) {
                        // apprently node 6.1.0 unhandledRejection is not great too, to be tested
                        if (this.agent.version.major === 6 && this.agent.version.minor === 1) {
                            return false;
                        }
                        return true;
                    }
                    return false;
                }
                return false;
            });

            // es6 support is composed of many check because we will load concatened polyfill
            var es6Requirements = [
                // global requirements
                'iterator',
                'map',
                'promise',
                'set',
                'symbol',
                'weak-map',
                'reflect',
                // array requirements
                'array-from',
                'array-of',
                'array-is-array',
                'array-fill',
                'array-find',
                'array-find-index',
                'array-values',
                'array-keys',
                'array-entries',
                'array-every',
                'array-some',
                'array-iterator',
                // string requirements
                'string-trim',
                'string-includes',
                'string-repeat',
                'string-ends-with',
                'string-starts-with',
                'string-iterator',
                // object requirements
                'object-assign',
                'object-create',
                'object-is'
            ];

            defineSupportDetector('es6', function() {
                var i = es6Requirements.length;
                while (i--) {
                    var es6Requirement = es6Requirements[i];
                    if (this.support(es6Requirement) === false) {
                        this.debug('es6 not supported : missing', es6Requirement);
                        return false;
                    }
                }
                return true;
            });
        });

        build(function coreNeeds() {
            var needs = {};

            ['set-immediate', 'promise', 'url', 'url-search-params', 'es6'].forEach(function(name) {
                needs[name] = this.support(name) === false;
            }, this);

            return {
                needs: needs
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

                createSystem: function() {
                    // dont touch the global System, use a local one
                    var System = Object.create(this.SystemPrototype);
                    System.constructor();

                    System.transpiler = 'babel';
                    // System.trace = true;
                    System.babelOptions = {};
                    System.paths.babel = this.dirname + '/node_modules/babel-core/browser.js';
                    // .json auto handled as json
                    System.meta['*.json'] = {format: 'json'};

                    System.config({
                        map: {
                            'source-map': this.dirname + '/node_modules/source-map'
                        },
                        packages: {
                            "source-map": {
                                main: 'source-map.js',
                                format: 'cjs',
                                defaultExtension: 'js'
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

                    this.registerCoreModule(this.rootModuleName, jsenv);
                    this.registerCoreModule(this.moduleName, this);

                    [
                        'agent-more',
                        'exception-handler',
                        'file-source',
                        'remap-error-stack',
                        'i18n',
                        'language',
                        'module-coverage',
                        'module-test',
                        'platform-more',
                        'rest',
                        'restart',
                        'service-http',
                        'stream',
                        'stacktrace'
                    ].forEach(function(libName) {
                        var libPath = this.dirname + '/lib/' + libName + '/index.js';
                        this.System.paths[this.moduleName + '/' + libName] = libPath;
                    }, this);

                    [
                        'action',
                        'array-sorted',
                        'dependency-graph',
                        'fetch-as-text',
                        'iterable',
                        'lazy-module',
                        'options',
                        'proto',
                        'thenable',
                        'timeout',
                        'uri'
                    ].forEach(function(utilName) {
                        var utilPath = this.dirname + '/lib/util/' + utilName + '/index.js';
                        this.System.paths[this.moduleName + '/' + utilName] = utilPath;
                        // add a global name too for now
                        this.System.paths[utilName] = utilPath;
                    }, this);

                    // jsenv.debug('configured env system');
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
                    if (this.support('descriptor')) {
                        var accessed = false;
                        var self = this;

                        Object.defineProperty(this.global, 'System', {
                            configurable: true,
                            get: function() {
                                if (accessed === false) {
                                    // env.warn(
                                    //     'global.System used at ',
                                    //     new Error().stack.split('\n')[1],
                                    //     ', use jsenv.System instead'
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

                setup: function() {
                    return Promise.resolve().then(function() {
                        // this is just a way to make things faster because we already go the transpiledSource without having to query the filesystem
                        // for now I'll just disable this because it's only for perf reason
                        // I have to enable this for anonymous module anyway
                        var System = this.System;
                        var self = this;

                        var translate = System.translate;
                        System.translate = function(load) {
                            // console.log('translate', load.source);
                            self.sources.set(load.address, load.source);

                            return translate.call(this, load).then(function(transpiledSource) {
                                var loadMetadata = load.metadata;
                                var loadFormat = loadMetadata.format;
                                if (loadFormat !== 'json') {
                                    self.sources.set(load.address, transpiledSource);
                                    // we could speed up sourcemap by reading it from load.metadata.sourceMap;
                                    // but systemjs set it to undefined after transpilation (load.metadata.sourceMap = undefined)
                                    // saying it's now useless because the transpiled embeds it in base64
                                    // https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L3578
                                    // I keep this commented as a reminder that sourcemap could be available using load.metadata
                                    // I may open an issue on github about this, fore as it's only a perf issue I think it will never happen
                                    // function readSourceMapFromModuleMeta() { }
                                }
                                return transpiledSource;
                            });
                        };

                        // to review :
                        // we should warn when two different things try to add a source for a given module
                        // for instance if moduleSource.set('test.js', 'source') is called while there is already
                        // a source for test.js we must throw because it's never supposed to happen
                        // it's not a big error but it means there is two something to improve and maybe something wrong
                        // we should store source found in sourcemap in module-source, maybe not according to above
                        // but if the source is supposed to exists then check that it does exists (keep in mind nested sourcemap)
                        // finally stackTrace.firstCallSite.loadFile will try to load a file that may be accessible in moduleSources so check it
                    }.bind(this)).then(function() {
                        return this.import(this.dirname + '/setup.js');
                    }.bind(this));
                },

                install: function() {
                    var installPromise;

                    if (jsenv.installPromise) {
                        installPromise = jsenv.installPromise;
                    } else {
                        installPromise = jsenv.import('env/file-source').then(function(exports) {
                            return exports.default;
                        }).then(function(sources) {
                            jsenv.sources = sources;
                        }).then(function() {
                            // tod only if node or a browser which does not support sourcemap (firefox)
                            return System.import('env/remap-error-stack');
                        });

                        jsenv.installPromise = installPromise;
                    }

                    return installPromise;
                },

                generate: function(options) {
                    return jsenv.install().then(function() {
                        var env = jsenv.create(options);

                        return env.setup().then(function() {
                            return env;
                        });
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
        var files = [];

        function add(name, path) {
            files.push({
                name: name,
                url: jsenv.dirname + '/' + path
            });
        }

        if (jsenv.support('set-immediate') === false) {
            add('set-immediate-polyfill', 'lib/polyfill/set-immediate/index.js');
        }
        if (jsenv.support('promise') === false) {
            add('promise-polyfill', 'lib/polyfill/promise/index.js');
        }
        if (jsenv.support('url') === false) {
            add('url-polyfill', 'lib/polyfill/url/index.js');
        }

        if (jsenv.isBrowser()) {
            add('systemjs', 'node_modules/systemjs/dist/system.js');
        } else {
            add('systemjs', 'node_modules/systemjs/index.js');
        }

        if (jsenv.support('es6') === false) {
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

            var scriptLoadedGlobalMethodAssignment = jsenv.installGlobalMethod(scriptLoadedMethodName, function() {
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
        // name of the global method used to create env object
        jsenv.globalName = 'jsenv';
        // set the name of a future module that will export env
        jsenv.rootModuleName = 'jsenv';
        jsenv.moduleName = 'env';
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

    jsenv.globalAssignment = jsenv.createCancellableAssignment(jsenv.global, jsenv.globalName);
    jsenv.globalAssignment.assign(jsenv);

    // list requirements amongst setimmediate, promise, url, url-search-params, es6 polyfills & SystemJS
    var files = listFiles(jsenv);
    includeFiles(jsenv, files, function() {
        jsenv.SystemPrototype = jsenv.global.System;
        delete jsenv.global.System; // remove System from the global scope
        jsenv.constructor();
    });
})();
