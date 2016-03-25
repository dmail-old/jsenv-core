/* eslint-env browser, node */

(function() {
    var engine = {
        define: function(fn) {
            var properties = fn();

            for (var key in properties) { // eslint-disable-line
                this[key] = properties[key];
            }
        }
    };

    // version management logic
    engine.define(function() {
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
    engine.define(function() {
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
    engine.define(function() {
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
    engine.define(function() {
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
    engine.define(function() {
        var exceptionHandler = {
            raisedExceptions: [],
            handlers: [],

            add: function(exceptionHandler) {
                this.handlers.push(exceptionHandler);
            },

            createException: function(value) {
                var exception = new Exception(value);
                return exception;
            },

            findExceptionByValue: function(value) {
                var raisedExceptions = this.raisedExceptions;
                var i = 0;
                var j = raisedExceptions.length;
                var raisedException;

                for (;i < j; i++) {
                    raisedException = raisedExceptions[i];
                    if (raisedException.value === value) {
                        return raisedException;
                    }
                }
                return null;
            },

            handleError: function(error) {
                var exception = this.findExceptionByValue(error);
                if (!exception) {
                    // don't handle same error twice because unhandledException will call this
                    exception = this.createException(error);
                    exception.raise();
                }
                return exception;
            },

            handleRejection: function(rejectedValue, promise) {
                var exception = this.findExceptionByValue(rejectedValue);
                if (!exception) {
                    // don't handle same error twice because unhandledRejection will call this
                    exception = this.createException(rejectedValue);
                    exception.promise = promise;
                    exception.raise();
                }
                return exception;
            },

            markPromiseAsHandled: function(promise) {
                for (var exception in this.raisedExceptions) {
                    if ('promise' in exception && exception.promise === promise) {
                        exception.recover();
                        break;
                    }
                }
            },

            markExceptionAsRecovered: function(exception) {
                this.raisedExceptions.splice(this.raisedExceptions.indexOf(exception), 1);
            }
        };

        function RecoverAttempt(exception) {
            this.exception = exception;
            this.index = 0;
            this.handlers = exceptionHandler.handlers.slice();
            return this.nextHandler();
        }

        RecoverAttempt.prototype = {
            createExceptionStatusPromise: function() {
                var exception = this.exception;
                var promise;

                if (exception.recovered) {
                    promise = Promise.resolve(exception.value);
                } else {
                    promise = Promise.reject(exception.value);
                }

                return promise;
            },

            nextHandler: function() {
                var handlers = this.handlers;
                var exception = this.exception;
                var promise;
                var index = this.index;

                if (index < handlers.length) {
                    var value = exception.value;
                    var handler = handlers[index];
                    this.index++;

                    promise = new Promise(function(res) {
                        res(handler(value, exception));
                    }).then(
                        function(/* resolutionValue */) {
                            exception.recover();
                            return this.createExceptionStatusPromise();
                        }.bind(this),
                        function(rejectionValue) {
                            var promise;

                            if (rejectionValue === value) {
                                console.log('going to next exception handler');
                                promise = this.nextHandler();
                            } else {
                                // an error occured during exception handling, log it and consider exception as not recovered
                                console.error(
                                    'the following occurred during exception handling : ',
                                    rejectionValue
                                );
                                promise = this.createExceptionStatusPromise();
                            }

                            return promise;
                        }.bind(this)
                    );
                } else {
                    // console.log('no more exception handler');
                    promise = this.createExceptionStatusPromise();
                }

                return promise;
            }
        };

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

        function Exception(value) {
            this.value = value;
        }

        Exception.prototype = {
            recovered: false,

            recover: function() {
                if (this.recovered === false) {
                    this.recovered = true;
                    exceptionHandler.markExceptionAsRecovered(this);
                }
            },

            attemptToRecover: function() {
                var exception = this;

                exceptionHandler.raisedExceptions.push(exception);

                return new RecoverAttempt(exception).catch(function() {
                    // console.error('fatal exception', exception.value);
                    setTimeout(function() {
                        process.removeListener('uncaughtException', error);
                        // we catched this so disable global error listener and just throw
                        engine.throw(exception.value);
                    }, 100);
                });
            },

            raise: function() {
                this.attemptToRecover();
            }
        };

        function error(error) {
            return exceptionHandler.handleError(error);
        }

        function unhandledRejection(value, promise) {
            return exceptionHandler.handleRejection(value, promise);
        }

        function rejectionHandled(promise) {
            return exceptionHandler.markPromiseAsHandled(promise);
        }

        if (engine.isBrowser()) {
            window.addEventListener('unhandledRejection', function(error, promise) {
                engine.unhandledRejection(error, promise);
            });
            window.addEventListener('rejectionHandled', function(promise) {
                engine.rejectionHandled(promise);
            });
            window.onerror = function(errorMsg, url, lineNumber, column, error) {
                engine.error(error);
            };
        } else {
            process.on('unhandledRejection', unhandledRejection);
            process.on('rejectionHandled', rejectionHandled);
            process.on('uncaughtException', error);
        }

        return {
            throw: function(value) {
                throw value;
            },

            error: error,
            unhandledRejection: unhandledRejection,
            rejectionHandled: rejectionHandled
        };
    });

    // config + run logic
    engine.define(function() {
        var configListeners = [];
        var runListeners = [];

        function callEveryListener(list, name, initialValue) {
            return list.reduce(function(previous, listener) {
                return previous.then(function(value) {
                    engine.debug('call', name, listener.name);
                    return listener(value);
                });
            }, Promise.resolve(initialValue));
        }

        return {
            config: function(listener) {
                configListeners.push(listener);
            },

            run: function(listener) {
                runListeners.push(listener);
            },

            ready: function() {
                return callEveryListener(configListeners, 'config').then(function(value) {
                    return callEveryListener(runListeners, 'run', value);
                });
            }
        };
    });

    // location logic
    engine.define(function() {
        var baseURL;
        var location;
        var systemLocation;
        var polyfillLocation;
        var resolve;

        if (engine.isBrowser()) {
            resolve = function(to, base) {
                return new URL(to, base).href;
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

            engine.nodeFile = function(filename) {
                if (mustReplaceBackSlashBySlash) {
                    filename = replaceBackSlashBySlash(filename);
                }
                return 'file:///' + filename;
            };

            baseURL = (function() {
                var cwd = process.cwd();
                var baseURL = engine.nodeFile(cwd);
                if (baseURL[baseURL.length - 1] !== '/') {
                    baseURL += '/';
                }
                return baseURL;
            })();
            location = engine.nodeFile(__filename);

            resolve = function(to, base) {
                if (mustReplaceBackSlashBySlash) {
                    to = replaceBackSlashBySlash(to);
                    base = replaceBackSlashBySlash(base);
                }

                return new URL(to, base).href;
            };

            systemLocation = 'node_modules/systemjs/index.js';
            polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';
        }

        return {
            baseURL: baseURL, // from where am I running system-run
            location: location, // where is this file
            dirname: location.slice(0, location.lastIndexOf('/')), // dirname of this file
            systemLocation: systemLocation, // where is the system file
            polyfillLocation: polyfillLocation, // where is the babel polyfill file

            locateFrom: function(location, baseLocation, stripFile) {
                var href = resolve(location, baseLocation);

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
        };
    });

    // include logic
    engine.define(function() {
        var include;

        if (engine.isBrowser()) {
            include = function(url, done) {
                var script = document.createElement('script');

                script.src = url;
                script.type = 'text/javascript';
                script.onload = function() {
                    done();
                };
                script.onerror = function(error) {
                    done(error);
                };

                document.head.appendChild(script);
            };
        } else {
            include = function(url, done) {
                var error;

                if (url.indexOf('file:///') === 0) {
                    url = url.slice('file:///'.length);
                }

                try {
                    require(url);
                } catch (e) {
                    error = e;
                }

                done(error);
            };
        }

        return {
            include: include
        };
    });

    // global logic
    engine.define(function() {
        var globalValue;

        if (engine.isBrowser()) {
            globalValue = window;
        } else {
            globalValue = global;

            globalValue.require = function(moduleId) {
                // console.log('use global require on', moduleId);
                return require(moduleId);
            };
        }

        globalValue.engine = engine;

        return {
            global: globalValue
        };
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
        registerCoreModule('engine-type', engine.type);

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
                    var sourceMap = new Buffer(rawData, 'base64').toString();
                    // engine.debug('read sourcemap from base64 for', fromURL);
                    sourceMapPromise = Promise.resolve(sourceMap);
                    sourceMapURL = null;
                } else {
                    // Support source map URLs relative to the source URL
                    // engine.debug('the sourcemap url is', sourceMapURL);
                    sourceMapURL = new URL(sourceMapURL, fromURL).toString();
                    // engine.debug('read sourcemap from file');
                    sourceMapPromise = System.import(sourceMapURL + '!json');
                }
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
                    return source;
                });
            });
        };

        // engine.readSourceMap = readSourceMap;
        // engine.sources = sources;

        engine.sources = sources;
    });

    // ensure sourcemap support on nodejs
    engine.config(function sourceMapSupport() {
        var active = engine.isProcess();
        // active = false;

        if (!active) {
            return;
        }

        var StackTrace = require('@dmail/node-stacktrace');
        var SourceMapConsumer = require('source-map').SourceMapConsumer;

        function readSourceMapFromEngine(path) {
            path = path.replace('!transpiled', '');
            // path = System.normalize(path);

            var sources = engine.sources;
            var sourceMap;

            if (path in sources) {
                sourceMap = sources[path].sourceMap;
            } else {
                // console.warn('no sourcemap for ' + path);
                // throw new Error('source undefined for ' + path);
            }

            return sourceMap;
        }

        // Maps a file path to a source map for that file
        var sourceMaps = {};
        function mapSourcePosition(position) {
            var sourceLocation = position.source;
            var sourceMap;

            if (sourceLocation in sourceMaps) {
                sourceMap = sourceMaps[sourceLocation];
            } else {
                sourceMap = readSourceMapFromEngine(sourceLocation);

                console.log('get source map', sourceMap);

                if (sourceMap) {
                    sourceMap = {
                        url: sourceMap.url,
                        map: new SourceMapConsumer(sourceMap.map)
                    };
                    // Load all sources stored inline with the source map into the file cache
                    // to pretend like they are already loaded. They may not exist on disk.
                    /*
                    if (sourceMap.map.sourcesContent) {
                        sourceMap.map.sources.forEach(function(source, i) {
                            var contents = sourceMap.map.sourcesContent[i];
                            if( contents ){
                                var url = supportRelativeURL(sourceMap.url, source);
                                fileContentsCache[url] = contents;
                            }
                        });
                    }
                    */
                } else {
                    sourceMap = {
                        url: null,
                        map: null
                    };
                }

                sourceMaps[sourceLocation] = sourceMap;
            }

            console.log('got sourcemap for', sourceLocation, '?', Boolean(sourceMap));

            // Resolve the source URL relative to the URL of the source map
            if (sourceMap.map) {
                var originalPosition = sourceMap.map.originalPositionFor(position);

                // console.log('getting original position', originalPosition.source);

                // Only return the original position if a matching line was found. If no
                // matching line is found then we return position instead, which will cause
                // the stack trace to print the path and line for the compiled file. It is
                // better to give a precise location in the compiled file than a vague
                // location in the original file.
                if (originalPosition.source !== null) {
                    originalPosition.source = new URL(
                        sourceMap.url || sourceLocation,
                        originalPosition.source
                    ).toString();
                    return originalPosition;
                }
            }

            return position;
        }

        function transformCallSite(callSite, index, callSites) {
            var source = callSite.getScriptNameOrSourceURL() || callSite.getFileName();

            if (source && source !== __filename) {
                var line = callSite.getLineNumber();
                var column = callSite.getColumnNumber() - 1;

                // Fix position in Node where some (internal) code is prepended.
                // See https://github.com/evanw/node-source-map-support/issues/36
                var fromModule = typeof process !== 'undefined' && callSites.length &&
                callSites[callSites.length - 1].getFileName() === 'module.js';
                if (fromModule && line === 1) {
                    column -= 63;
                }

                var position = mapSourcePosition({
                    source: source,
                    line: line,
                    column: column
                });

                //console.log('update callsite source to', position.source);

                callSite.source = position.source;
                callSite.lineNumber = position.line;
                callSite.columnNumber = position.column + 1;
            }

            /*
            if( callSite.isEval() ){
                console.log('handling isEval calls');

                var evalOrigin = callSite.getEvalOrigin();
                var evalSsource = evalOrigin.getFileName() || evalOrigin.getScriptNameOrSourceURL();
                var evalLine = evalOrigin.getLineNumber();
                var evalColumn = evalOrigin.getColumnNumber() - 1;

                var evalPosition =  mapSourcePosition({
                    source: source,
                    line: evalSsource,
                    column: evalColumn
                });

                callSite.evalFileName = evalPosition.source;
                callSite.evalLineNumber = evalPosition.line;
                callSite.evalColumnNumber = evalPosition.column + 1;
            }
            */

            // Code called using eval() needs special handling
            /*
            if( callSite.isEval() ){
                var evalOrigin = callSite.getEvalOrigin();

                if( evalOrigin ){
                    mapCallSite(evalOrigin);
                }
            }
            */

            // console.log('mapping', source, 'into', callSite.source);
        }

        StackTrace.setTransformer(transformCallSite);

        /*
        var improveSyntaxError = function(error) {
            if (error && error.name === 'SyntaxError' && error._babel) {
                // error.loc contains {line: 0, column: 0}
                var match = error.message.match(/([\s\S]+): Unterminated string constant \(([0-9]+)\:([0-9]+)/);

                if (match) {
                    var improvedError = new SyntaxError();
                    var column = match[3];
                    column += 63; // because node-sourcemap/index.js:155 will do column-=63

                    var stack = '';

                    stack += 'SyntaxError: Unterminated string constant\n\t at ';
                    stack += match[1] + ':' + match[2] + ':' + column;

                    improvedError.stack = stack;

                    return improvedError;
                }
            }

            return error;
        };

        var translate = System.translate;
        System.translate = function(load) {
            return translate.call(this, load).catch(function(error) {
                error = improveSyntaxError(error);
                return Promise.reject(error);
            });
        };
        */

        engine.trace = function(error) {
            var stack; // eslint-disable-line no-unused-vars
            var stackTrace;

            if (arguments.length > 0) {
                if ((error instanceof Error) === false) {
                    throw new TypeError('engine.trace() first argument must be an error');
                }

                stack = error.stack; // will set error.stackTrace
                stackTrace = error.stackTrace;
            } else {
                error = new Error();
                stack = error.stack; // will set error.stackTrace
                stackTrace = error.stackTrace;
                stackTrace.callSites.shift(); // remove this line of the stack trace
            }

            return stackTrace;
        };

        // we have to define the throw method else stack trace is not correctly printed
        engine.throw = function(exception) {
            // throw exception;
            console.log('here');
            console.error(exception);
            process.exit(1);
        };

        // not needed anymore thanks to Error.prepareStackTrace used in node-sourcemap
        /*
        var importMethod = System.import;
        System.import = function(){
            return importMethod.apply(this, arguments).catch(function(error){
                error = sourceMap.transformError(error, readSource);
                return Promise.reject(error);
            });
        };

        process.on('uncaughtException', function handleUncaughtException(error){
            sourceMap.transformError(error, readSource);
            throw error;
        });
        */
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
    engine.config(function configFile() {
        console.log('loading', engine.dirname + '/config/' + engine.agent.type + '.js');
        return System.import(engine.dirname + '/config/' + engine.agent.type + '.js');
    });

    // load dependencies then call engine.ready()
    // platform.info(platform.type, platform.location, platform.baseURL);
    (function() {
        var dependencies = [];

        dependencies.push({
            name: 'URLSearchParams',
            url: 'node_modules/@dmail/url-search-params/index.js',
            condition: function() {
                return ('URLSearchParams' in engine.global) === false;
            }
        });

        dependencies.push({
            name: 'URL',
            url: 'node_modules/@dmail/url/index.js',
            condition: function() {
                return ('URL' in engine.global) === false;
            }
        });

        dependencies.push({
            name: 'Object.assign',
            url: 'node_modules/@dmail/object-assign/index.js',
            condition: function() {
                return ('assign' in Object) === false;
            }
        });

        dependencies.push({
            name: 'Object.complete',
            url: 'node_modules/@dmail/object-complete/index.js',
            condition: function() {
                return ('complete' in Object) === false;
            }
        });

        dependencies.push({
            name: 'setImmediate',
            url: 'node_modules/@dmail/set-immediate/index.js',
            condition: function() {
                return ('setImmediate' in engine.global) === false;
            }
        });

        dependencies.push({
            name: 'Promise',
            url: 'node_modules/@dmail/promise-es6/index.js',
            condition: function() {
                return true; // force because of node promise not implementing unhandled rejection
                // return false === 'Promise' in platform.global;
            }
        });

        dependencies.push({
            name: 'babel-polyfill',
            url: engine.polyfillLocation
        });

        dependencies.push({
            name: 'System',
            url: engine.systemLocation,
            condition: function() {
                return ('System' in engine.global) === false;
            },
            instantiate: function() {
                // logic moved to config
            }
        });

        function includeDependencies(dependencies, callback) {
            var i = 0;
            var j = dependencies.length;
            var dependency;

            function done(error) {
                setTimeout(function() {
                    callback(error);
                }, 0);
            }

            function includeNext(error) {
                if (error) {
                    engine.debug('include error', error);
                    done(error);
                } else if (i === j) {
                    engine.debug('all dependencies included');
                    done();
                } else {
                    dependency = dependencies[i];
                    i++;

                    if (!dependency.condition || dependency.condition()) {
                        engine.debug('loading', dependency.name);
                        dependency.url = engine.dirname + '/' + dependency.url;
                        engine.include(dependency.url, function(error) {
                            if (error) {
                                includeNext(error);
                            } else {
                                if (dependency.instantiate) {
                                    dependency.instantiate();
                                }
                                includeNext();
                            }
                        });
                    } else {
                        engine.debug('skipping', dependency.name);
                        includeNext();
                    }
                }
            }

            includeNext();
        }

        includeDependencies(dependencies, function(error) {
            if (error) {
                engine.debug('error ocurred');
                throw error; // why not engine.throw ?
            } else {
                engine.debug('call setup');
                engine.ready().catch(engine.unhandledRejection);
            }
        });
    })();
})();
