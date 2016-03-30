/* eslint-env browser, node */

(function() {
    var engine = {};

    // engine.provide adds functionnality to engine object
    // it can be called anywhere but it makes more sense to call it as soon as possible to provide functionalities asap
    engine.provide = function(fn) {
        var properties = fn();

        if (properties) {
            for (var key in properties) { // eslint-disable-line
                this[key] = properties[key];
            }
        }
    };

    // version management logic, on va appeler ça dans un setup et plus un provide
    engine.provide(function version() {
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

    // platform logic, platform is what runs the agent : windows, linux, mac, ..
    engine.provide(function platform() {
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

        return {
            platform: platform
        };
    });

    // agent logic, agent is what runs JavaScript : nodejs, iosjs, firefox, ...
    engine.provide(function agent() {
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

        return {
            agent: agent,

            isBrowser: function() {
                return this.agent.type === 'browser';
            },

            isProcess: function() {
                return this.agent.type === 'process';
            }
        };
    });

    // log logic
    engine.provide(function logging() {
        var logLevel;

        if (engine.isProcess() && process.argv.indexOf('-verbose') !== -1) {
            logLevel = 'info';
        } else {
            logLevel = 'error';
        }

        logLevel = 'debug';

        return {
            logLevel: logLevel,

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
        };
    });

    // exception management logic
    engine.provide(function exception() {
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
            // unRecoveredException: undefined,
            handledException: undefined,
            pendingExceptions: [],

            add: function(exceptionHandler) {
                this.handlers.push(exceptionHandler);
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

            handleException: function(exception) {
                if (this.hasOwnProperty('ignoreExceptionWithValue') &&
                    this.ignoreExceptionWithValue === exception.value) {
                    return;
                }

                if (this.handledException) {
                    this.pendingExceptions.push(exception);
                    return this.promise;
                }
                this.handledException = exception;
                this.promise = exception.attemptToRecover().then(function(recovered) {
                    if (recovered) {
                        this.handledException = undefined;
                        if (this.pendingExceptions.length) {
                            var pendingException = this.pendingExceptions.shift();
                            return this.handleException(pendingException); // now try to recover this one
                        }
                    } else {
                        // put in a timeout to prevent promise from catching this exception
                        setTimeout(function() {
                            engine.crash(exception);
                        });
                    }
                }.bind(this));
                return this.promise;
            },

            markPromiseAsHandled: function(promise) {
                var handledException = this.handledException;

                if (handledException) {
                    if (handledException.isComingFromPromise(promise)) {
                        handledException.recover();
                    } else {
                        for (var exception in this.pendingExceptions) {
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

            raise: function() {
                return exceptionHandler.handleException(this);
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
                window.addEventListener('unhandledRejection', unhandledRejection);
                window.addEventListener('rejectionHandled', rejectionHandled);
                window.onerror = function(errorMsg, url, lineNumber, column, error) {
                    catchError(error);
                };
            };
            disableHooks = function() {
                window.removeEventListener('unhandledRejection', unhandledRejection);
                window.removeEventListener('rejectionHandled', rejectionHandled);
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

        return {
            exceptionHandler: exceptionHandler,
            crash: function(exception) {
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

                this.throw(exception.value);

                // enabledHooks in case throwing error did not terminate js execution
                // in the browser or if external code is listening for process.on('uncaughException');
                this.enable();
            },
            throw: function(value) {
                throw value;
            }
        };
    });

    // location logic
    engine.provide(function location() {
        var baseURL;
        var location;
        var systemLocation;
        var polyfillLocation;
        var clean;

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

            systemLocation = 'node_modules/systemjs/dist/system.js';
            polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
        } else {
            var mustReplaceBackSlashBySlash = process.platform.match(/^win/);
            var replaceBackSlashBySlash = function(path) {
                return path.replace(/\\/g, '/');
            };

            clean = function(path) {
                if (mustReplaceBackSlashBySlash) {
                    path = replaceBackSlashBySlash(String(path));
                }
                if (path.match(/^[A-Z]:\/\//)) {
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

            systemLocation = 'node_modules/systemjs/index.js';
            polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';
        }

        return {
            baseURL: baseURL, // from where am I running system-run
            location: location, // where is this file
            dirname: location.slice(0, location.lastIndexOf('/')), // dirname of this file
            systemLocation: systemLocation, // where is the system file
            polyfillLocation: polyfillLocation, // where is the babel polyfill file
            cleanPath: clean
        };
    });

    // global logic
    engine.provide(function global() {
        var globalValue;

        if (engine.isBrowser()) {
            globalValue = window;
        } else {
            globalValue = global;
        }

        globalValue.engine = engine;

        return {
            global: globalValue
        };
    });

    // include logic
    engine.provide(function include() {
        var include;

        if (engine.isBrowser()) {
            include = function(url) {
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
            include = function(url) {
                if (url.indexOf('file:///') === 0) {
                    url = url.slice('file:///'.length);
                }

                return new Promise(function(resolve) {
                    resolve(require(url));
                });
            };
        }

        return {
            include: include
        };
    });

    // phases
    engine.provide(function start() {
        /*
        WARNING : if your env does not support promise you must add an inline polyfill during init : before engine.start()

        in an external file you can do, once this file is included

        engine.setup(function() {}); // function or file executed in serie onceengine.start is called
        engine.config(function() {}); // function or file executed in serie once setup is done
        engine.run(function() {}); // function or file executed in serie once once run is done & main module is imported (engine.mainModule)
        engine.start('./path/to/file.js'); // start the engine executing setup/config/run phases then importing the mainModule passed as argument
        */

        var Task = function() {
            if (arguments.length === 1) {
                if (typeof arguments[0] === 'function') {
                    this.name = arguments[0].name;
                    this.method = arguments[0];
                } else if (typeof arguments[0] === 'object') {
                    var properties = arguments[0];
                    for (var key in properties) { // eslint-disable-line
                        this[key] = properties[key];
                    }
                }
            } else if (arguments.length === 2) {
                this.name = arguments[0];
                this.method = arguments[1];
            }
        };

        Task.prototype = {
            name: undefined,
            skipped: false,
            done: false,

            before: null,
            condition: null,
            url: null,
            after: null,
            next: null,

            chain: function(task) {
                if (this.done) {
                    throw new Error(this.name + 'task is done : cannot chain more task to it');
                }

                if (this.next) {
                    return this.next.chain(task);
                }
                this.next = task;
                return this;
            },

            insert: function(task, beforeTask) {
                if (beforeTask) {
                    var next = this.next;
                    if (!next) {
                        throw new Error('cannot insert before a task which has no next task');
                    }

                    if (next === beforeTask) {
                        this.next = null;
                        task.chain(next);
                        this.chain(task);
                    }
                    return next.insert(task, beforeTask);
                }

                return this.chain(task);
            },

            import: function() {
                return engine.include(this.url);
            },

            exec: function(value) {
                return this.url ? this.import() : this.fn(value);
            },

            end: function(value) {
                this.passed = true;
                return Promise.resolve(value).then(function(resolutionValue) {
                    if (this.after) {
                        return this.after(resolutionValue);
                    }
                    return resolutionValue;
                }.bind(this)).then(function(resolutionValue) {
                    if (this.next) {
                        return this.next.perform(resolutionValue);
                    }
                    return resolutionValue;
                });
            },

            start: function(value) {
                engine.task = this;

                return Promise.resolve(value).then(function(resolutionValue) {
                    if (this.before) {
                        return this.before(resolutionValue);
                    }
                    return resolutionValue;
                }).then(function(resolutionValue) {
                    if (this.condition && !this.condition) {
                        this.skipped = true;
                    }

                    if (this.skipped) {
                        engine.debug('skip task', this.name);
                        return resolutionValue;
                    }
                    return this.exec(resolutionValue);
                }.bind(this)).then(this.end.bind(this));
            }
        };

        var noop = function() {};
        var initTask = new Task('init', noop);
        var setupTask = new Task('setup', noop);
        var configTask = new Task('config', noop);
        var mainTask = new Task('main', function() {
            engine.mainImport = System.import(engine.mainLocation).then(function(mainModule) {
                engine.mainModule = mainModule;
                return mainModule;
            });
            return engine.mainImport;
        });
        var runTask = new Task('run', noop);

        initTask.chain(setupTask).chain(configTask).chain(mainTask).chain(runTask);

        return {
            Task: Task,
            task: undefined,

            setup: function(task) {
                return initTask.insert(task, configTask);
            },

            config: function(task) {
                return initTask.insert(task, runTask);
            },

            run: function(task) {
                // insert at the end
                return initTask.insert(task);
            },

            start: function(mainModuleData) {
                if (typeof mainModuleData === 'string') {
                    this.mainLocation = engine.locate(mainModuleData);
                } else {
                    throw new Error('engine.start() expect a mainModule argument');
                }

                initTask.start();
            }
        };
    });

    engine.setup({
        name: 'URLSearchParams',
        url: engine.dirname + '/node_modules/@dmail/url-search-params/index.js',
        condition: function() {
            return ('URLSearchParams' in engine.global) === false;
        }
    });

    engine.setup({
        name: 'URL',
        url: engine.dirname + '/node_modules/@dmail/url/index.js',
        condition: function() {
            return ('URL' in engine.global) === false;
        }
    });

    engine.setup({
        name: 'Object.assign',
        url: engine.dirname + '/node_modules/@dmail/object-assign/index.js',
        condition: function() {
            return ('assign' in Object) === false;
        }
    });

    engine.setup({
        name: 'Object.complete',
        url: engine.dirname + '/node_modules/@dmail/object-complete/index.js',
        condition: function() {
            return ('complete' in Object) === false;
        }
    });

    engine.setup({
        name: 'setImmediate',
        url: engine.dirname + '/node_modules/@dmail/set-immediate/index.js',
        condition: function() {
            return ('setImmediate' in engine.global) === false;
        }
    });

    engine.setup({
        name: 'Promise',
        url: engine.dirname + '/node_modules/@dmail/promise-es6/index.js',
        condition: function() {
            return true; // force because of node promise not implementing unhandled rejection
            // return false === 'Promise' in platform.global;
        }
    });

    engine.setup({
        name: 'babel-polyfill',
        url: engine.dirname + '/' + engine.polyfillLocation
    });

    engine.setup({
        name: 'System',
        url: engine.dirname + '/' + engine.systemLocation,
        condition: function() {
            return ('System' in engine.global) === false;
        },
        after: function() {
            engine.include = System.import;
        }
    });

    engine.config(function enableExceptionHandler() {
        // enable exception handling only once the setup phase is done
        engine.exceptionHandler.enable();
    });

    engine.config(function locate() {
        Object.assign(engine, {
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

    // ensure transpiling with babel & System.trace = true
    engine.config(function system() {
        System.transpiler = 'babel';
        System.babelOptions = {};
        System.paths.babel = engine.dirname + '/node_modules/babel-core/browser.js';
        System.trace = true;
    });

    // core modules config
    engine.config(function coreModules() {
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

        System.paths.proto = engine.dirname + '/node_modules/@dmail/proto/index.js';
    });

    // ensure sources (a pointer on module original sources & sourcemap needed by sourcemap & coverage)
    engine.config(function sources() {
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

        // in order to get the file as it's going to appear in error stack but ignore this for now
        // var sourceURLRegexp = /\/\/#\s*sourceURL=\s*(\S*)\s*/mg;
        /*
        function readSourceUrl() {
            var lastMatch;
            var match;

            while (match = sourceURLRegexp.exec(source)) { // eslint-disable-line
                lastMatch = match;
            }

            return lastMatch ? lastMatch[1] : null;
        }
        */

        // returns a {map, optional url} object, or null if
        // there is no source map. The map field may be either a string or the parsed JSON object
        function readSourceMap(source, fromURL) {
            var sourceMapURL = readSourceMapURL(source);
            var sourceMapPromise;

            if (sourceMapURL) {
                var base64SourceMapRegexp = /^data:application\/json[^,]+base64,/;
                if (base64SourceMapRegexp.test(sourceMapURL)) {
                    // Support source map URL as a data url
                    var rawData = sourceMapURL.slice(sourceMapURL.indexOf(',') + 1);
                    var sourceMap = JSON.parse(new Buffer(rawData, 'base64').toString());
                    // engine.debug('read sourcemap from base64 for', fromURL);
                    sourceMapPromise = Promise.resolve(sourceMap);
                    sourceMapURL = null;
                } else {
                    // Support source map URLs relative to the source URL
                    // engine.debug('the sourcemap url is', sourceMapURL);
                    sourceMapURL = engine.locateFrom(sourceMapURL, fromURL);
                    // engine.debug('read sourcemap from file');
                    sourceMapPromise = System.import(sourceMapURL + '!json');
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

        var sources = {};
        var translate = System.translate;
        System.translate = function(load) {
            var originalSource = load.source;

            return translate.call(this, load).then(function(source) {
                var metadata = load.metadata;
                var format = metadata.format;
                if (format === 'json' || format === 'defined' || format === 'global' || metadata.loader) {
                    return source;
                }

                // get sourcemap from transpiled source because systemjs do load.metadata.sourceMap = undefined
                // even if systemjs remove this undefined setter we need this in case transpiler do not set sourceMap
                // in meta but appended it to the bottom of the file source
                var sourceMapPromise;
                var sourceMap = metadata.sourceMap;
                if (sourceMap) {
                    sourceMapPromise = Promise.resolve(sourceMap);
                } else {
                    // engine.debug('reading sourcemap from file source, the file is', load.name);
                    sourceMapPromise = readSourceMap(source, load.name);
                }

                return sourceMapPromise.then(function(sourceMap) {
                    sources[load.name] = {
                        source: originalSource,
                        sourceMap: sourceMap
                    };

                    // Load all sources stored inline with the source map into the file cache
                    // to pretend like they are already loaded. They may not exist on disk.
                    if (false && sourceMap && sourceMap.map && sourceMap.map.sourcesContent) {
                        console.log('populate source content');
                        sourceMap.map.sources.forEach(function(source, i) {
                            var contents = sourceMap.map.sourcesContent[i];
                            if (contents) {
                                var location;
                                if (sourceMap.url) {
                                    location = engine.locateFrom(source, sourceMap.url);
                                } else {
                                    location = engine.locate(source);
                                }
                                sources[location] = {
                                    source: contents,
                                    map: readSourceMap(contents, location)
                                };
                            }
                        });
                    }

                    return source;
                });
            });
        };

        // engine.readSourceMap = readSourceMap;
        engine.sources = sources;
        engine.getSourceMap = function(path) {
            // path = System.normalize(path);

            var sources = this.sources;
            var sourceMap;

            if (path in sources) {
                sourceMap = sources[path].sourceMap;
            } else {
                // console.warn('no sourcemap for ' + path);
                // throw new Error('source undefined for ' + path);
            }

            return sourceMap;
        };
    });

    // language config, language used by the agent (firefox, node, ...)
    engine.config(function language() {
        /*
        dans un module tu fais

        import I18N from 'i18n';

        let i18n = I18N.module('moduleName', {
            fr: './i18n/fr.js', // path to a file
            en: {hello: "Hello"} // inline
        });

        du coup pour ce module on a direct les i18n dont on a besoin et la liste des i18n dispo
        lorsque le module est chargé par system-run il faudrais qu'il regarde la liste et pour le language en cours
        charge le fichier de langue

        il faudrais le faire pour le module chargé et pour nimporte quel sous-module qu'on charge en tant que dépendance
        */

        var language = {
            // default: 'en',
            name: '',
            locale: '',

            toString: function() {
                return this.name + '-' + this.locale;
            },

            set: function(string) {
                var parts = string.split('-');

                this.name = parts[0].toLowerCase();
                this.locale = parts[1] ? parts[1].toLowerCase() : '';

                engine.registerCoreModule('engine-language', this.toString());
            },

            listPreferences: function() {
                return '';
            },

            /*
            we can't known the availableLanguages without doing a request somewhere to get the list.
            a .config() call can set proposed languages by any means

            once language.init is called we known the best language to use, it's set into engine-language core module
            most of the time we'll then add a .run() call to load the right i18n file that we're going to populate on I18N module
            when is the I18N module loaded -> System.import('i18n') in a run() followed by i18n population with the loaded file

            https://github.com/systemjs/systemjs/blob/master/lib/conditionals.js

            we cannot have a conditional static loader:
                - we would prevent module from loading the english translations when engine-language is not en
                but we cannot force this only if there is a language for this module

            current proposed solution:
                - let every module load his default language then when we wants to use this default language
                check the global I18N object if there is a better language for this module, if so use it
                else populate i18n of this module with the default languague not overiding any existing key
                -> we're loading a useless file that may never be useful, for now it's ok

            If we don't load the default language for each module what happens?
            the module has noi18n file so i18n will fails all the time
            we may consider that once engine.config are done
            we try to load the most appropriate i18n file right from where we are /i18n/$[language.name}.js
            se we don't load a useless file
            that would be a great solution but let's imagine this

            main/
                index.js -> will load i18/en.js but will not load dependency/i18n/en.js
                i18n/
                    en.js
            dependency/
                index.js
                i18n/
                    en.js

            and we can't check for every import if the file i18n-ified
            i18n should be automated and it's not fat from the way to go, keep thinking
            a sort of meta inside index.js saying hey I got i18n files could be amazing
            maybe a special export const i18nFolder = './i18n' would do the trick

            ./i18n/en.js
            import I18N;
            export default I18N.module('schema').addLanguage('en', {});

            ./index.js
            import './i18n/?#{engine-language-is-en}.js'; // ne charger que si le module est en anglais, sinon on prend

            il faudrais combiner la liste des languages dispo pour une module globalement et localement
            puis récupérer le meilleur parmi ceux là et enfin le charger

            bon y'a deux cas :
                le module ne dispose que d'un language, localement:
                    on charge ce language que si globalement aucun meilleur language n'est loadé
                le module dispose de plusieurs language localement :
                    on charge le meilleur language parmi ceux dispo globalement et localement

            */
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

    /*
    // this will be part of a nother module called eco-system that will be what most future module will depends on
    // eco-system takes care of module dependency, hot reloading from github etc...
    System.import(platform.dirname + '/namespace.js').then(function(exports) {
        var NameSpaceConfig = exports['default']; // eslint-disable-line dot-notation
        var nameSpaceConfig = NameSpaceConfig.create();

        nameSpaceConfig.add({
            namespace: 'dmail',
            path: 'file:///C:/Users/Damien/Documents/Github'
        });

        var normalize = System.normalize;
        System.normalize = function(moduleName , parentModuleName, parentModuleUrl) {
            moduleName = nameSpaceConfig.locate(moduleName);
            return normalize.apply(this, arguments);
        };
    });
    */

    // file config
    engine.config(engine.dirname + '/config/' + engine.agent.type + '.js');

    // engine.info(engine.type, engine.location, engine.baseURL);
})();
