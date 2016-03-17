/* eslint-env browser, node */

(function() {
    var Version = (function() {
        function Version(string) {
            var parts = String(string).split('.');

            this.major = parseInt(parts[0]);
            this.minor = parts[1] ? parseInt(parts[1]) : 0;
            this.patch = parts[2] ? parseInt(parts[2]) : 0;
        }

        Version.prototype = {
            toString: function() {
                return this.major + '.' + this.minor + '.' + this.patch;
            }
        };

        return Version;
    })();

    var engine = {
        define: function(properties) {
            for (var key in properties) { // eslint-disable-line
                this[key] = properties[key];
            }
        },

        // platform: what is running the agent, windows, linux, mac, ...
        platform: {
            name: 'unknown',
            version: '',

            setName: function(name) {
                this.name = name.toLowerCase();
            },

            setVersion: function(version) {
                this.version = new Version(version);
            },

            is: function(engine) {
                return this.name === engine.name;
            }
        },

        // language used by the agent
        language: {
            name: 'en',
            locale: '',

            toString: function() {
                return this.name + '-' + this.locale;
            },

            set: function(language) {
                var parts = (language || '').split('-');

                this.name = parts[0].toLowerCase();
                this.locale = parts[1] ? parts[1].toLowerCase() : '';
            }
        }
    };

    // agent logic
    engine.define((function() {
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

        // agent : what running JavaScript nodejs, iosjs, firefox, ...
        var agent = {
            type: type,
            name: 'unknown',
            version: 'unknown',

            setName: function(name) {
                this.name = name.toLowerCase();
            },

            setVersion: function(version) {
                this.version = new Version(version);
            },

            is: function(agent) {
                return this.name === agent.name;
            }
        };

        return {
            agent: agent
        };
    })());

    // log logic
    engine.define((function() {
        var logLevel;

        if (engine.agent.type === 'process' && process.argv.indexOf('-verbose') !== -1) {
            logLevel = 'info';
        } else {
            logLevel = 'error';
        }

        return {
            logLevel: logLevel,

            info: function() {
                if (this.logLevel === 'info') {
                    console.info.apply(console, arguments);
                }
            },

            debug: function() {
                if (this.logLevel === 'debug') {
                    console.log.apply(console, arguments);
                }
            }
        };
    })());

    // exception management logic
    engine.define((function() {
        var exceptionHandler = {
            exceptions: [],
            handlers: [],

            add: function(exceptionHandler) {
                this.handlers.push(exceptionHandler);
            },

            createException: function(value) {
                var exception = new Exception(value);
                return exception;
            },

            handleError: function(error) {
                var exception = this.createException(error);
                exception.raise();
                return exception;
            },

            handleRejection: function(rejectedValue, promise) {
                var exception = this.createException(rejectedValue);
                exception.promise = promise;
                exception.raise();
                return exception;
            },

            markPromiseAsHandled: function(promise) {
                for (var exception in this.exceptions) {
                    if ('promise' in exception && exception.promise === promise) {
                        exception.recover();
                        break;
                    }
                }
            },

            markExceptionAsRecovered: function(exception) {
                this.exceptions.splice(this.exceptions.indexOf(exception), 1);
            },

            attemptToRecover: function(exception) {
                this.exceptions.push(exception);

                return new RecoverAttempt(exception).catch(function() {
                    engine.throw(exception.value);
                });
            }
        };

        function RecoverAttempt(exception) {
            this.exception = exception;
            this.index = 0;
            this.handlers = exceptionHandler.exceptions.slice();
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

                if (this.index < handlers.length) {
                    var value = exception.value;
                    var handler = handlers[this.index];
                    this.index++;

                    promise = new Promise(function(res) {
                        res(handler(value));
                    }).then(
                        function(/* resolutionValue */) {
                            exception.recover();
                            return this.createExceptionStatusPromise();
                        }.bind(this),
                        function(rejectionValue) {
                            var promise;

                            if (rejectionValue === value) {
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

            raise: function() {
                exceptionHandler.attemptToRecover(this);
            }
        };

        var throwMethod;

        if (engine.agent.type === 'process') {
            throwMethod = function(error) {
                console.error(error);
                process.exit(1);
            };

            process.on('unhandledRejection', function(error, promise) {
                engine.unhandledRejection(error, promise);
            });
            process.on('rejectionHandled', function(promise) {
                engine.rejectionHandled(promise);
            });
            process.on('uncaughtException', function(error) {
                engine.error(error);
            });
        } else {
            throwMethod = function(error) {
                throw error;
            };

            window.addEventListener('unhandledRejection', function(error, promise) {
                engine.unhandledRejection(error, promise);
            });
            window.addEventListener('rejectionHandled', function(promise) {
                engine.rejectionHandled(promise);
            });
            window.onerror = function(errorMsg, url, lineNumber, column, error) {
                engine.error(error);
            };
        }

        return {
            throw: throwMethod,

            error: function(error) {
                return exceptionHandler.handleError(error);
            },

            unhandledRejection: function(value, promise) {
                return exceptionHandler.handleRejection(value, promise);
            },

            rejectionHandled: function(promise) {
                exceptionHandler.markPromiseAsHandled(promise);
            }
        };
    })());

    // location logic
    engine.define((function() {
        var baseURL;
        var location;
        var systemLocation;
        var polyfillLocation;

        if (engine.agent.type === 'browser') {
            baseURL = (function() {
                var href = window.location.href.split('#')[0].split('?')[0];
                var base = href.slice(0, href.lastIndexOf('/') + 1);

                return base;
            })();

            location = document.scripts[document.scripts.length - 1].src;
            systemLocation = 'node_modules/systemjs/dist/system.js';
            polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
        } else {
            baseURL = (function() {
                var base = 'file:///' + process.cwd();

                if (process.platform.match(/^win/)) {
                    base = base.replace(/\\/g, '/');
                }
                if (base[base.length - 1] !== '/') {
                    base += '/';
                }

                return base;
            })();

            location = 'file:///' + (process.platform === 'win32' ? __filename.replace(/\\/g, '/') : __filename);
            systemLocation = 'node_modules/systemjs/index.js';
            polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';
        }

        return {
            baseURL: baseURL,
            location: location,
            systemLocation: systemLocation,
            polyfillLocation: polyfillLocation,

            locateFrom: function(location, baseLocation, stripFile) {
                var href = new URL(location, baseLocation).href;

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
    })());

    // ready logic
    engine.define((function() {
        var readyListeners = [];

        return {
            onready: function() {
                return readyListeners.reduce(function(previous, listener) {
                    return previous.then(listener);
                }, Promise.resolve());
            },

            run: function(listener) {
                readyListeners.push(listener);
            }
        };
    })());

    if (typeof window !== 'undefined') {
        engine.restart = function() {
            window.reload();
        };

        engine.include = function(url, done) {
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

        engine.global = window;
    } else if (typeof process !== 'undefined') { // eslint-disable-line no-negated-condition
        engine.restart = function() {
            process.kill(2);
        };

        engine.include = function(url, done) {
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

        engine.global = global;

        engine.global.require = function(moduleId) {
            // console.log('use global require on', moduleId);
            return require(moduleId);
        };

        var run = function(location) {
            var path = require('path');

            location = location.replace(/\\/g, '/');
            location = 'file:///' + location;

            // require platform
            require(path.resolve(__dirname, './index.js'));

            engine.ready(function() {
                engine.info('running', engine.locate(location));
                return System.import(location);
            });
        };

        module.exports = run;
    }

    engine.dirname = engine.location.slice(0, engine.location.lastIndexOf('/'));
    engine.global.engine = engine;
    // platform.info(platform.type, platform.location, platform.baseURL);

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
            System.transpiler = 'babel';
            System.babelOptions = {};
            System.paths.babel = engine.dirname + '/node_modules/babel-core/browser.js';
            System.trace = true;

            if (engine.type === 'process') {
                var nodeSourceMap = require('system-node-sourcemap');
                nodeSourceMap.install();

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
            }
        }
    });

    function includeDependencies(dependencies, callback) {
        var i = 0;
        var j = dependencies.length;
        var dependency;

        function done(error) {
            setImmediate(function() {
                callback(error);
            });
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

    function createModuleExportingDefault(defaultExportsValue) {
        /* eslint-disable quote-props */
        return System.newModule({
            "default": defaultExportsValue
        });
        /* eslint-enable quote-props */
    }

    engine.registerCoreModule = function(moduleName, defaultExport) {
        System.set(moduleName, createModuleExportingDefault(defaultExport));
    };

    function setup() {
        engine.registerCoreModule('engine', engine);
        engine.registerCoreModule('engine-type', engine.type);

        System.paths.proto = engine.dirname + '/node_modules/@dmail/proto/index.js';

        engine.defaultLanguage = 'en';
        System.import(engine.dirname + '/setup/' + engine.type + '.js').then(function() {
            if (!engine.language) {
                engine.language = engine.defaultLanguage;
            }
            // here test if platform.language is set, else set it to the defaultLanguage
            // + we should take into account locale
            engine.registerCoreModule('engine-language', engine.language);

            engine.onready();
        });

        /*
        // here we may want to load some i18n file for languages or any other configuration file
        // as developement or production variables
        // this setup logic should be accessible to the consumer of this library by any mean, maybe it should
        // not be part of this but be done like so:
        // global.platform.ready(function() {
            // load some config files, do anything you want before
            // System.import('module_starting_the_application');
        // });
        // it would allow anyone to put his own configuration logic and is the way to go concerning user setup

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
    }

    includeDependencies(dependencies, function(error) {
        if (error) {
            engine.debug('error ocurred');

            throw error;
        } else {
            engine.debug('call setup');

            setup();
        }
    });
})();
