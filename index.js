/* eslint-env browser, node */

(function() {
    var engine = {};

    // engine.provide adds functionnality to engine object
    // it can be called anywhere but it makes more sense to call it as soon as possible to provide functionalities asap
    engine.provide = function(data) {
        var properties = typeof data === 'function' ? data() : data;

        if (properties) {
            for (var key in properties) { // eslint-disable-line
                this[key] = properties[key];
            }
        }
    };

    // task
    (function() {
        /*
        WARNING : if your env does not support promise you must provide a polyfill before calling engine.start()

        in an external file you can do, once this file is included

        engine.config(function() {}); // function or file executed in serie once setup is done
        engine.run(function() {}); // function or file executed in serie once once run is done & main module is imported (engine.mainModule)
        engine.start('./path/to/file.js'); // start the engine executing config tasks, then the main task (import main module) then run tasks
        */

        var Task = function() {
            if (arguments.length === 1) {
                if (typeof arguments[0] === 'function') {
                    this.name = arguments[0].name;
                    this.fn = arguments[0];
                } else if (typeof arguments[0] === 'object') {
                    var properties = arguments[0];
                    for (var key in properties) { // eslint-disable-line
                        this[key] = properties[key];
                    }
                } else if (typeof arguments[0] === 'string') {
                    this.name = arguments[0];
                    this.url = this.name;
                }
            } else if (arguments.length === 2) {
                this.name = arguments[0];
                this.fn = arguments[1];
            }
        };

        Task.prototype = {
            name: undefined,
            skipped: false,
            ended: false,
            next: null,

            chain: function(task) {
                if (this.ended) {
                    throw new Error(this.name + 'task is ended : cannot chain more task to it');
                }

                // engine.debug('do', task.name, 'after', this.name);

                var next = this.next;
                if (next) {
                    next.chain(task);
                } else {
                    this.next = task;
                }

                return this;
            },

            insert: function(task, beforeTask) {
                if (beforeTask) {
                    var next = this.next;
                    if (!next) {
                        throw new Error('cannot insert ' + task.name + ' before ' + beforeTask.name);
                    }

                    if (next === beforeTask) {
                        this.next = null;

                        this.chain(task);
                        task.chain(next);
                        return this;
                    }
                    return next.insert(task, beforeTask);
                }

                return this.chain(task);
            },

            skip: function(reason) {
                this.skipped = true;
                reason = reason || 'no specific reason';
                engine.debug('skip task', this.name, ':', reason);
            },

            import: function() {
                this.address = engine.locate(this.url);
                engine.debug('importing', this.url);
                return engine.import(this.url);
            },

            exec: function(value) {
                return this.fn(value);
            },

            before: function(value) {
                return value;
            },

            after: function(value) {
                this.ended = true;

                if (this.next) {
                    // will throw but it will be ignored
                    return this.next.start(value);
                }
                return value;
            },

            start: function(value) {
                // engine.info(engine.type, engine.location, engine.baseURL);
                engine.task = this;
                engine.debug('start task', this.name);

                return Promise.resolve(value).then(
                    this.before.bind(this)
                ).then(function(resolutionValue) {
                    if (this.skipped) {
                        return resolutionValue;
                    }
                    return this.exec(resolutionValue);
                }.bind(this)).then(
                    this.after.bind(this)
                );
            }
        };

        var noop = function() {};
        var configTask = new Task('config', noop);
        var mainTask = new Task('main', function() {
            engine.mainImport = System.import(engine.mainLocation).then(function(mainModule) {
                engine.mainModule = mainModule;
                return mainModule;
            });
            return engine.mainImport;
        });
        var runTask = new Task('run', noop);

        configTask.chain(mainTask).chain(runTask);

        function config(taskData) {
            var task = new Task(taskData);
            configTask.insert(task, mainTask);
            return task;
        }

        function run(taskData) {
            var task = new Task(taskData);
            mainTask.chain(task);
            return task;
        }

        engine.provide({
            task: undefined,
            config: config,
            run: run,

            start: function(mainModuleData) {
                if (typeof mainModuleData === 'string') {
                    this.mainLocation = mainModuleData;
                } else {
                    throw new Error('engine.start() expect a mainModule argument');
                }

                // the problem here is that we are still using native or user polyfilled Promise implementation
                // which may not support unhandledRejection
                // for this reason we have to catch the error explicitely
                // the impact is that external code calling engine.start().catch() will never catch anything because
                // error is handled by exceptionHandler

                return configTask.start().then(function() {
                    return engine.mainModule;
                }).catch(function(error) {
                    engine.exceptionHandler.handleError(error);
                });
            }
        });
    })();

    engine.provide(function provideAgent() {
        // agent is what runs JavaScript : nodejs, iosjs, firefox, ...
        var type;

        if (typeof window !== 'undefined') {
            type = 'browser';
        } else if (typeof process !== 'undefined') { // eslint-disable-line no-negated-condition
            type = 'process';
        } else {
            type = 'unknown';
        }

        if (type === 'unknown') {
            throw new Error('unknown agent');
        }

        var agent = {
            type: type,
            name: 'unknown',
            version: 'unknown',

            setName: function(name) {
                this.name = name.toLowerCase();
            },

            setVersion: function(version) {
                this.version = engine.createVersion(version);
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

        engine.provide({
            agent: agent,

            isBrowser: function() {
                return this.agent.type === 'browser';
            },

            isProcess: function() {
                return this.agent.type === 'process';
            }
        });
    });

    engine.provide(function provideGlobal() {
        var globalValue;

        if (engine.isBrowser()) {
            globalValue = window;
        } else if (engine.isProcess()) {
            globalValue = global;
        }

        globalValue.engine = engine;

        return {
            global: globalValue
        };
    });

    engine.provide(function provideVersion() {
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

        engine.provide({
            createVersion: function(string) {
                return new Version(string);
            }
        });
    });

    engine.provide(function providePlatform() {
        // platform is what runs the agent : windows, linux, mac, ..

        var platform = {
            name: 'unknown',
            version: '',

            setName: function(name) {
                this.name = name.toLowerCase();
            },

            setVersion: function(version) {
                this.version = engine.createVersion(version);
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

        engine.platform = platform;
    });

    engine.provide(function provideLogger() {
        engine.provide({
            logLevel: 'debug', // 'error',

            info: function() {
                if (this.logLevel === 'info') {
                    console.info.apply(console, arguments);
                }
            },

            warn: function() {
                console.warn.apply(console, arguments);
            },

            debug: function() {
                if (this.logLevel === 'debug') {
                    console.log.apply(console, arguments);
                }
            }
        });
    });

    engine.provide(function provideLocationData() {
        var baseURL;
        var location;
        var clean;
        var parentPath;

        /*
        once URL is loaded I must create some special object doing the following :

        create an URLPath object that will parse a pathname into
        dirname, extname, basename, filename
        with resolve(otherPath) & relative(otherPath) methods

        engine.createURL = function() {
            // creates a custom object that will use URLSearchParams and URLPath objects
            // and will have a relative(otherURL) method to make the url relative
        };

        engine.baseURL = engine.createURL(engine.baseURL);
        engine.location = engine.createURL(engine.location);

        then I'll be able to do

        engine.location.resolve('./file.js');
        engine.baseURL.resolve('./file.js');

        engine.location will be renamed url
        engine.baseURL will be renamed mainURL

        instead of engine.locateFrom('./file.js', engine.location);
        */

        parentPath = function(path) {
            return path.slice(0, path.lastIndexOf('/'));
        };

        if (engine.isBrowser()) {
            clean = function(path) {
                return path;
            };

            baseURL = (function() {
                var href = window.location.href.split('#')[0].split('?')[0];
                var base = href.slice(0, href.lastIndexOf('/') + 1);

                return base;
            })();
            location = document.scripts[document.scripts.length - 1].src;
        } else {
            var mustReplaceBackSlashBySlash = process.platform.match(/^win/);
            var replaceBackSlashBySlash = function(path) {
                return path.replace(/\\/g, '/');
            };

            clean = function(path) {
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
                var baseURL = clean(cwd);
                if (baseURL[baseURL.length - 1] !== '/') {
                    baseURL += '/';
                }
                return baseURL;
            })();
            location = clean(__filename);
        }

        return {
            baseURL: baseURL, // from where am I running system-run
            location: location, // where is this file
            dirname: parentPath(location), // dirname of this file
            cleanPath: clean,
            parentPath: parentPath
        };
    });

    engine.config(function provideLanguage() {
        // languague used by the agent

        var language = {
            preferences: [],

            listPreferences: function() {
                return '';
            },

            bestLanguage: function(proposeds) {
                return Promise.resolve(this.listPreferences()).then(function(preferenceString) {
                    var preferences = preferenceString.toLowerCase().split(',');
                    var best;

                    // get first language matching exactly
                    best = proposeds.find(function(proposed) {
                        return preferences.findIndex(function(preference) {
                            return preference.startsWith(proposed);
                        });
                    });

                    if (!best) {
                        best = proposeds[0];
                    }

                    return best;
                });
            }
        };

        engine.language = language;
    });

    engine.config(function provideExceptionHandler() {
        /*
        // wait 1000ms before throwing any error
        engine.exceptionHandler.add(function(e){
            return new Promise(function(res, rej){ setTimeout(function(){ rej(e); }, 1000); });
        });
        // do not throw error with code itsok
        engine.exceptionHandler.add(function(e){
            return e && e instanceof Error && e.code === 'itsok' ? undefined : Promise.reject(e);
        });
        */

        var exceptionHandler = {
            handlers: [],
            handledException: undefined,
            pendingExceptions: [],

            add: function(exceptionHandler) {
                this.handlers.push(exceptionHandler);
            },

            throw: function(value) {
                throw value;
            },

            createException: function(value) {
                var exception = new Exception(value);
                return exception;
            },

            handleError: function(error) {
                var exception;

                exception = this.createException(error);
                exception.raise();

                return exception;
            },

            handleRejection: function(rejectedValue, promise) {
                var exception;

                exception = this.createException(rejectedValue);
                exception.promise = promise;
                exception.raise();

                return exception;
            },

            markPromiseAsHandled: function(promise) {
                var handledException = this.handledException;

                if (handledException) {
                    if (handledException.isComingFromPromise(promise)) {
                        handledException.recover();
                    } else {
                        var pendings = this.pendingExceptions;
                        var i = pendings.length;
                        while (i--) {
                            var exception = pendings[i];
                            if (exception.isComingFromPromise(promise)) {
                                exception.recover();
                                break;
                            }
                        }
                    }
                }
            }
        };

        function Exception(value) {
            this.value = value;
            this.recoveredPromise = new Promise(function(resolve) {
                this.resolve = resolve;
            }.bind(this));
        }

        Exception.prototype = {
            promise: undefined,
            settled: false,
            recovered: false,

            isRejection: function() {
                return this.hasOwnProperty('promise');
            },

            isComingFromPromise: function(promise) {
                return this.isRejection() && this.promise === promise;
            },

            attemptToRecover: function() {
                var exception = this;
                var index = 0;
                var handlers = exceptionHandler.handlers.slice();
                var nextHandler = function() {
                    var promise;

                    if (exception.settled) {
                        promise = Promise.resolve(this.recovered);
                    } else if (index < handlers.length) {
                        var handler = handlers[index];
                        index++;

                        promise = new Promise(function(resolve) {
                            resolve(handler(exception.value, exception));
                        }).then(
                            function(/* resolutionValue */) {
                                return true;
                            },
                            function(rejectionValue) {
                                if (rejectionValue === exception.value) {
                                    engine.debug('call next exception handler');
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

                // let handler make exception recover or propagate
                nextHandler().then(function(recovered) {
                    if (recovered) {
                        exception.recover();
                    } else {
                        exception.propagate();
                    }
                });

                return exception.recoveredPromise;
            },

            recover: function() {
                if (this.settled === false) {
                    if (this.pending) {
                        exceptionHandler.pendingExceptions.splice(exceptionHandler.pendingExceptions.indexOf(this), 1);
                    }
                    this.settled = true;
                    this.recovered = true;
                    this.resolve(true);
                }
            },

            propagate: function() {
                if (this.settled === false) {
                    this.settled = true;
                    this.recovered = false;
                    this.resolve(false);
                }
            },

            throw: function(value) {
                throw value;
            },

            crash: function() {
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
                exceptionHandler.disable();
                exceptionHandler.throw(this.value);
                // enabledHooks in case throwing error did not terminate js execution
                // in the browser or if external code is listening for process.on('uncaughException');
                exceptionHandler.enable();
            },

            raise: function() {
                var exception = this;

                if (exceptionHandler.handledException) {
                    this.pending = true;
                    exceptionHandler.pendingExceptions.push(this);
                } else {
                    exceptionHandler.handledException = this;
                    this.attemptToRecover().then(function(recovered) {
                        if (recovered) {
                            exceptionHandler.handledException = undefined;
                            if (exceptionHandler.pendingExceptions.length) {
                                var pendingException = exceptionHandler.pendingExceptions.shift();
                                pendingException.raise(); // now try to recover this one
                            }
                        } else {
                            // put in a timeout to prevent promise from catching this exception
                            setTimeout(function() {
                                exception.crash();
                            });
                        }
                    });
                }
            }
        };

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
        if (engine.isBrowser()) {
            enableHooks = function() {
                window.onunhandledrejection = unhandledRejection;
                window.onrejectionhandled = rejectionHandled;
                window.onerror = function(errorMsg, url, lineNumber, column, error) {
                    catchError(error);
                };
            };
            disableHooks = function() {
                window.onunhandledrejection = undefined;
                window.onrejectionhandled = undefined;
                window.onerror = undefined;
            };
        } else if (engine.isProcess()) {
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

        engine.provide({
            exceptionHandler: exceptionHandler
        });
    });

    engine.config(function configExceptionHandler() {
        engine.exceptionHandler.enable();
    });

    engine.config(function provideImport() {
        var importMethod;

        if (engine.isBrowser()) {
            importMethod = function(url) {
                var script = document.createElement('script');
                var promise = new Promise(function(resolve, reject) {
                    script.onload = resolve;
                    script.onerror = reject;
                });

                script.src = url;
                script.type = 'text/javascript';
                document.head.appendChild(script);

                return promise;
            };
        } else {
            importMethod = function(url) {
                if (url.indexOf('file:///') === 0) {
                    url = url.slice('file:///'.length);
                }

                return new Promise(function(resolve) {
                    resolve(require(url));
                });
            };
        }

        engine.import = importMethod;
    });

    engine.config(function polyfillURLSearchParams() {
        if ('URLSearchParams' in engine.global) {
            this.skip();
        } else {
            return engine.import(engine.dirname + '/node_modules/@dmail/url-search-params/index.js');
        }
    });

    engine.config(function polyfillURL() {
        if ('URL' in engine.global) {
            this.skip();
        } else {
            return engine.import(engine.dirname + '/node_modules/@dmail/url/index.js');
        }
    });

    engine.config(function provideLocate() {
        engine.provide({
            locateFrom: function(location, baseLocation, stripFile) {
                var href = new URL(this.cleanPath(location), this.cleanPath(baseLocation)).href;

                if (stripFile && href.indexOf('file:///') === 0) {
                    href = href.slice('file:///'.length);
                }

                return href;
            },

            locate: function(location, stripFile) {
                return this.locateFrom(location, this.baseURL, stripFile);
            },

            locateRelative: function(location, stripFile) {
                var trace = this.trace();

                trace.callSites.shift();

                return this.locateFrom(location, trace.fileName, stripFile);
            },

            locateFromRoot: function(location) {
                return this.locateFrom(location, this.location, true);
            }
        });
    });

    engine.config(function locateMain() {
        engine.mainLocation = engine.locate(engine.mainLocation);
    });

    engine.config(function polyfillObjectAssign() {
        if ('assign' in Object) {
            this.skip();
        } else {
            return engine.import(engine.dirname + '/node_modules/@dmail/object-assign/index.js');
        }
    });

    engine.config(function polyfillObjectComplete() {
        if ('complete' in Object) {
            this.skip();
        } else {
            return engine.import(engine.dirname + '/node_modules/@dmail/object-complete/index.js');
        }
    });

    engine.config(function polyfillSetImmediate() {
        if ('setImmediate' in engine.global) {
            this.skip('not needed');
        } else {
            return engine.import(engine.dirname + '/node_modules/@dmail/set-immediate/index.js');
        }
    });

    engine.config(function polyfillPromise() {
        if ('Promise' in engine.global) {
            // test if promise support unhandledrejection hook, if so just dont load promise
            // this test is async and involves detecting for browser or node dependening on platform, ignore for now
        }

        // always load my promise polyfill because some Promise implementation does not provide
        // unhandledRejection
        return engine.import(engine.dirname + '/node_modules/@dmail/promise-es6/index.js');
    });

    engine.config(function polyfillES6() {
        var polyfillLocation;

        if (engine.isBrowser()) {
            polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
        } else {
            polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';
        }

        return engine.import(engine.dirname + '/' + polyfillLocation);
    });

    engine.config(function importSystem() {
        var systemLocation;

        if (engine.isBrowser()) {
            systemLocation = 'node_modules/systemjs/dist/system.js';
        } else {
            systemLocation = 'node_modules/systemjs/index.js';
        }

        return engine.import(engine.dirname + '/' + systemLocation).then(function(module) {
            engine.import = System.import.bind(System);
            return module;
        });
    });

    // ensure transpiling with babel & System.trace = true
    engine.config(function configSystem() {
        System.transpiler = 'babel';
        System.babelOptions = {};
        System.paths.babel = engine.dirname + '/node_modules/babel-core/browser.js';
        System.trace = true;
    });

    // core modules config
    engine.config(function provideCoreModules() {
        function createModuleExportingDefault(defaultExportsValue) {
            /* eslint-disable quote-props */
            return System.newModule({
                "default": defaultExportsValue
            });
            /* eslint-enable quote-props */
        }

        function registerCoreModule(moduleName, defaultExport) {
            System.set(moduleName, createModuleExportingDefault(defaultExport));
        }

        registerCoreModule('engine', engine);
        // registerCoreModule('engine-type', engine.type);

        if (engine.isProcess()) {
            // https://github.com/sindresorhus/os-locale/blob/master/index.js
            var nativeModules = [
                'assert',
                'http',
                'https',
                'fs',
                'stream',
                'path',
                'url',
                'querystring',
                'child_process',
                'util',
                'os'
            ];

            nativeModules.forEach(function(name) {
                registerCoreModule('node/' + name, require(name));
            });

            registerCoreModule('node/require', require);
        }

        engine.registerCoreModule = registerCoreModule;
    });

    engine.config(function configInternalModules() {
        [
            'proto',
            'options',
            'dependency-graph',
            'test'
        ].forEach(function(moduleName) {
            System.paths['dmail/' + moduleName] = engine.dirname + '/lib/' + moduleName + '/index.js';
        });

        System.paths.proto = engine.dirname + '/node_modules/@dmail/proto/index.js';
    });

    // module source is the code you write
    engine.config(function provideModuleSources() {
        var moduleSources = new Map();

        var translate = System.translate;
        System.translate = function(load) {
            var moduleSource = load.source;
            moduleSources.set(load.name, moduleSource);
            return translate.call(this, load);
        };

        engine.provide({
            moduleSources: moduleSources
        });
    });

    engine.config(function provideModuleURLs() {
        var moduleURLs = new Map();

        // get real file name from sourceURL comment
        function readSourceUrl(source) {
            var lastMatch;
            var match;
            var sourceURLRegexp = /\/\/#\s*sourceURL=\s*(\S*)\s*/mg;
            while (match = sourceURLRegexp.exec(source)) { // eslint-disable-line
                lastMatch = match;
            }

            return lastMatch ? lastMatch[1] : null;
        }

        function getLoadOrSourceURL(source, loadURL) {
            var loadSourceURL = readSourceUrl(source);
            var loadOrSourceURL;
            // get filename from the source if //# sourceURL exists in it
            if (loadSourceURL) {
                loadOrSourceURL = loadSourceURL;
            } else {
                loadOrSourceURL = loadURL;
            }

            return loadOrSourceURL;
        }

        moduleURLs.store = function(source, loadURL) {
            var loadOrSourceURL;

            if (this.has(loadURL)) {
                loadOrSourceURL = this.get(loadURL);
            } else {
                loadOrSourceURL = getLoadOrSourceURL(source, loadURL);
                this.set(loadURL, loadOrSourceURL);
            }

            return loadOrSourceURL;
        };

        var translate = System.translate;
        System.translate = function(load) {
            return translate.call(this, load).then(function(source) {
                moduleURLs.store(source, load.name);
                return source;
            });
        };

        engine.provide({
            moduleURLs: moduleURLs
        });
    });

    // source is the executed code
    engine.config(function provideSources() {
        var sources = new Map();
        var translate = System.translate;
        System.translate = function(load) {
            return translate.call(this, load).then(function(source) {
                sources.set(engine.moduleURLs.get(load.name), source);
                return source;
            });
        };

        engine.provide({
            sources: sources
        });
    });

    engine.config(function storeMetaSourceMap() {
        // we could speed up sourcemap reading by storing load.metadata.sourceMap;
        // but anyway systemjs do load.metadata.sourceMap = undefined
        // so I just set this as a reminder that sourcemap could be available if set on load.metadata by the transpiler
    }).skip('not ready yet');

    engine.config(function provideSourceMaps() {
        function readSourceMapURL(source) {
            // Keep executing the search to find the *last* sourceMappingURL to avoid
            // picking up sourceMappingURLs from comments, strings, etc.
            var lastMatch;
            var match;
            // eslint-disable-next-line
            var sourceMappingURLRegexp = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/)[ \t]*$)/mg;
            while (match = sourceMappingURLRegexp.exec(source)) { // eslint-disable-line
                lastMatch = match;
            }

            return lastMatch ? lastMatch[1] : null;
        }

        // returns a {map, optional url} object, or null if there is no source map
        function fetchSourceMapData(source, rootURL) {
            var sourceMapURL = readSourceMapURL(source);
            var sourceMapPromise;

            if (sourceMapURL) {
                var base64SourceMapRegexp = /^data:application\/json[^,]+base64,/;
                if (base64SourceMapRegexp.test(sourceMapURL)) {
                    // Support source map URL as a data url
                    var rawData = sourceMapURL.slice(sourceMapURL.indexOf(',') + 1);
                    var sourceMap = JSON.parse(new Buffer(rawData, 'base64').toString());
                    // engine.debug('read sourcemap from base64 for', rootURL);
                    sourceMapPromise = Promise.resolve(sourceMap);
                    sourceMapURL = null;
                } else {
                    // Support source map URLs relative to the source URL
                    // engine.debug('the sourcemap url is', sourceMapURL);
                    sourceMapURL = engine.locateFrom(sourceMapURL, rootURL, true);
                    engine.debug('read sourcemap from file', sourceMapURL);

                    // try {
                    sourceMapPromise = Promise.resolve(require(sourceMapURL));
                    // } catch (e) {
                    //     sourceMapPromise = Promise.resolve();
                    // }
                }
            } else {
                sourceMapPromise = Promise.resolve();
            }

            return sourceMapPromise.then(function(sourceMap) {
                if (sourceMap) {
                    return {
                        url: sourceMapURL,
                        map: sourceMap
                    };
                }
                return null;
            });
        }

        var sourceMaps = new Map();
        function detectSourceMap(source, rootURL) {
            var sourceURL = engine.moduleURLs.store(source, rootURL);

            // now read sourceMap url and object from the source
            return fetchSourceMapData(source, sourceURL).then(function(sourceMapData) {
                // if we find a sourcemap, store it
                if (sourceMapData) {
                    var sourceMap = sourceMapData.map;
                    var sourceMapUrl = sourceMapData.url;

                    // engine.debug('set sourcemap for', sourceURL, Boolean(sourceMap));
                    sourceMaps.set(sourceURL, sourceMap);

                    // if sourcemap has contents check for nested sourcemap in the content
                    var sourcesContent = sourceMap.sourcesContent;
                    if (sourcesContent) {
                        return Promise.all(sourceMap.sources.map(function(source, i) {
                            var content = sourcesContent[i];
                            if (content) {
                                // we cannot do engine.moduleSources.set(source, content)
                                // because we can have many transpilation level like
                                // moduleSource -> babelSource -> minifiedSource

                                var sourceMapLocation;
                                // nested sourcemap can be relative to their parent
                                if (sourceMapUrl) {
                                    sourceMapLocation = engine.locateFrom(source, sourceMapUrl);
                                } else {
                                    sourceMapLocation = engine.locate(source);
                                }

                                return detectSourceMap(content, sourceMapLocation);
                            }
                            return undefined;
                        }));
                    }
                } else if (sourceMaps.has(sourceURL) === false) {
                    // if no sourcemap is found store a null object to know their is no sourcemap for this file
                    // the check sourceMaps.has(sourceURL) === false exists to prevent a indetical source wo
                    // sourcemap to set sourcemap to null when we already got one
                    // it happen when sourceMap.sourcesContent exists but does not contains sourceMap
                    sourceMaps.set(sourceURL, null);
                }
            });
        }

        var translate = System.translate;
        System.translate = function(load) {
            return translate.call(this, load).then(function(source) {
                var metadata = load.metadata;
                var format = metadata.format;
                if (format === 'json' || format === 'defined' || format === 'global' || metadata.loader) {
                    return source;
                }

                return detectSourceMap(source, load.name).then(function() {
                    return source;
                });
            });
        };

        engine.provide({
            sourceMaps: sourceMaps
        });
    });

    engine.config(function importAgentConfig() {
        return engine.import(engine.dirname + '/lib/config/' + engine.agent.type + '.js');
    });

    engine.config(function provideTest() {
        var test = {

        };

        test.install = function() {
            System.trace = true;
            System.execute = true;

            return new Promise(function(resolve) {
                engine.run(function runTests() {
                    resolve();
                });
            });
        };

        test.collect = function(module) {
            return System.import('dmail/test').then(function(testModule) {
                testModule.run(module);
            });
        };

        test.report = function() {
            // idéallement le report se fait en même temps que le test
            // donc ici on a pas cette notion
        };

        engine.provide({
            test: test
        });
    });
})();
