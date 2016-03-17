/* eslint-env browser, node */

(function() {
    var platform = {
        logLevel: 'error',
        readyListeners: [],

        info: function() {
            if (this.logLevel === 'info') {
                console.info.apply(console, arguments);
            }
        },

        debug: function() {
            if (this.logLevel === 'debug') {
                console.log.apply(console, arguments);
            }
        },

        ready: function(listener) {
            this.readyListeners.push(listener);
        },

        onready: function() {
            return this.readyListeners.reduce(function(previous, listener) {
                return previous.then(listener);
            }, Promise.resolve());
        },

        throw: function(error) {
            throw error;
        },

        exceptions: [],
        exceptionHandlers: [],
        addExceptionHandler: function(exceptionHandler) {
            this.exceptionHandlers.push(exceptionHandler);
        },
        /*
        // wait 1000ms before throwing any error
        platform.addExceptionHandler(function(e){
            return new Promise(function(res, rej){ setTimeout(function(){ rej(e); }, 1000); });
        });
        // do not throw error with code itsok
        platform.addExceptionHandler(function(e){
            return e && e instanceof Error && e.code === 'itsok' ? undefined : Promise.reject(e);
        });
        */
        createException: function(exceptionValue) {
            var exception = {
                value: exceptionValue,
                recovered: false,

                createStatusPromise: function() {
                    var promise;
                    if (this.recovered) {
                        promise = Promise.resolve(this.value);
                    } else {
                        promise = Promise.reject(this.value);
                    }

                    return promise;
                },

                nextHandler: function() {
                    var promise;

                    if (this.index < this.handlers.length) {
                        var value = this.value;
                        var handler = this.handlers[this.index];
                        this.index++;

                        promise = new Promise(function(res) {
                            res(handler(value));
                        }).then(
                            function(/* resolutionValue */) {
                                this.recover();
                                return this.createStatusPromise();
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
                                    promise = this.createStatusPromise();
                                }

                                return promise;
                            }.bind(this)
                        );
                    } else {
                        promise = this.createStatusPromise();
                    }

                    return promise;
                },

                // returns a promise rejected if the exception could not recover using its handlers
                attemptToRecover: function() {
                    this.index = 0;
                    this.handlers = [].concat(platform.exceptionHandlers);
                    return this.nextHandler();
                },

                recover: function() {
                    if (this.recovered === false) {
                        this.recovered = true;
                        platform.exceptions.splice(platform.exceptions.indexOf(this));
                    }
                },

                raise: function() {
                    platform.exceptions.push(this);

                    this.attemptToRecover().catch(function() {
                        platform.throw(this.value);
                    }.bind(this));
                }
            };

            return exception;
        },

        error: function(error) {
            var exception = this.createException(error);
            exception.raise();
            return exception;
        },

        unhandledRejection: function(value, promise) {
            var exception = this.createException(value);
            exception.promise = promise;
            exception.raise();
            return exception;
        },

        rejectionHandled: function(promise) {
            for (var exception in this.exceptions) {
                if ('promise' in exception && exception.promise === promise) {
                    exception.recover();
                    break;
                }
            }
        },

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
            var trace = platform.trace();

            trace.callSites.shift();

            return this.locateFrom(location, trace.fileName, stripFile);
        },

        locateFromRoot: function(location) {
            return this.locateFrom(location, this.location, true);
        },

        parseVersion: function(version) {
            var parts = String(version).split('.');

            return {
                major: parseInt(parts[0]),
                minor: parts[1] ? parseInt(parts[1]) : 0,
                patch: parts[2] ? parseInt(parts[2]) : 0,
                toString: function() {
                    return this.major + '.' + this.minor + '.' + this.patch;
                }
            };
        },

        setVersion: function(version) {
            this.version = this.parseVersion(version);
        },

        language: {
            default: 'en',
            name: '',
            locale: '',
            toString: function() {
                return this.name + '-' + this.locale;
            },

            set: function(language) {
                var parts = (language || '').split('-');

                this.name = parts[0].toLowerCase();
                this.locale = parts[1] ? parts[1].toLowerCase() : '';
            }
        },

        engine: {
            is: function(engine) {
                return this.name === engine.name;
            },

            name: '',
            version: '',

            setName: function(name) {
                this.name = name;
            },

            setVersion: function(version) {
                this.version = platform.parseVersion(version);
            }
        }
    };

    var baseURL;

    if (typeof window !== 'undefined') {
        platform.restart = function() {
            window.reload();
        };

        platform.include = function(url, done) {
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

        window.addEventListener('unhandledRejection', function(error, promise) {
            platform.unhandledRejection(error, promise);
        });
        window.addEventListener('rejectionHandled', function(promise) {
            platform.rejectionHandled(promise);
        });
        window.onerror = function(errorMsg, url, lineNumber, column, error) {
            platform.error(error);
        };

        baseURL = (function() {
            var href = window.location.href.split('#')[0].split('?')[0];
            var base = href.slice(0, href.lastIndexOf('/') + 1);

            return base;
        })();

        platform.type = 'browser';
        platform.global = window;
        platform.os = navigator.platform.toLowerCase();

        platform.baseURL = baseURL;
        platform.location = document.scripts[document.scripts.length - 1].src;
        platform.systemLocation = 'node_modules/systemjs/dist/system.js';
        platform.polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
    } else if (typeof process !== 'undefined') { // eslint-disable-line no-negated-condition
        platform.restart = function() {
            process.kill(2);
        };

        platform.throw = function(error) {
            console.error(error);
            process.exit(1);
        };

        platform.include = function(url, done) {
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

        process.on('unhandledRejection', function(error, promise) {
            platform.unhandledRejection(error, promise);
        });
        process.on('rejectionHandled', function(promise) {
            platform.rejectionHandled(promise);
        });
        process.on('uncaughtException', function(error) {
            platform.error(error);
        });

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

        platform.type = 'process';
        platform.global = global;
        // https://nodejs.org/api/process.html#process_process_platform
        // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
        platform.os = process.platform === 'win32' ? 'windows' : process.platform;

        platform.baseURL = baseURL;
        platform.location = 'file:///' + (platform.os === 'windows' ? __filename.replace(/\\/g, '/') : __filename);
        platform.systemLocation = 'node_modules/systemjs/index.js';
        platform.polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';

        if (process.argv.indexOf('-verbose') !== -1) {
            platform.logLevel = 'info';
        }

        platform.global.require = function(moduleId) {
            // console.log('use global require on', moduleId);
            return require(moduleId);
        };

        var run = function(location) {
            var path = require('path');

            location = location.replace(/\\/g, '/');
            location = 'file:///' + location;

            // require platform
            require(path.resolve(__dirname, './index.js'));

            platform.ready(function() {
                platform.info('running', platform.locate(location));
                return System.import(location);
            });
        };

        module.exports = run;
    } else {
        throw new Error('unknown platform');
    }

    platform.dirname = platform.location.slice(0, platform.location.lastIndexOf('/'));
    platform.global.platform = platform;
    platform.info(platform.name, platform.location, platform.baseURL);

    var dependencies = [];

    dependencies.push({
        name: 'URLSearchParams',
        url: 'node_modules/@dmail/url-search-params/index.js',
        condition: function() {
            return ('URLSearchParams' in platform.global) === false;
        }
    });

    dependencies.push({
        name: 'URL',
        url: 'node_modules/@dmail/url/index.js',
        condition: function() {
            return ('URL' in platform.global) === false;
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
            return ('setImmediate' in platform.global) === false;
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
        url: platform.polyfillLocation
    });

    dependencies.push({
        name: 'System',
        url: platform.systemLocation,
        condition: function() {
            return ('System' in platform.global) === false;
        },
        instantiate: function() {
            System.transpiler = 'babel';
            System.babelOptions = {};
            System.paths.babel = platform.dirname + '/node_modules/babel-core/browser.js';
            System.trace = true;

            if (platform.type === 'process') {
                var nodeSourceMap = require('system-node-sourcemap');
                nodeSourceMap.install();

                platform.trace = function(error) {
                    var stack; // eslint-disable-line no-unused-vars
                    var stackTrace;

                    if (arguments.length > 0) {
                        if ((error instanceof Error) === false) {
                            throw new TypeError('platform.trace() first argument must be an error');
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
                platform.debug('include error', error);
                done(error);
            } else if (i === j) {
                platform.debug('all dependencies included');
                done();
            } else {
                dependency = dependencies[i];
                i++;

                if (!dependency.condition || dependency.condition()) {
                    platform.debug('loading', dependency.name);
                    dependency.url = platform.dirname + '/' + dependency.url;
                    platform.include(dependency.url, function(error) {
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
                    platform.debug('skipping', dependency.name);
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

    platform.registerCoreModule = function(moduleName, defaultExport) {
        System.set(moduleName, createModuleExportingDefault(defaultExport));
    };

    function setup() {
        platform.registerCoreModule('platform', platform);
        platform.registerCoreModule('platform-type', platform.type);

        System.paths.proto = platform.dirname + '/node_modules/@dmail/proto/index.js';

        platform.defaultLanguage = 'en';
        System.import(platform.dirname + '/setup/' + platform.type + '.js').then(function() {
            if (!platform.language) {
                platform.language = platform.defaultLanguage;
            }
            // here test if platform.language is set, else set it to the defaultLanguage
            // + we should take into account locale
            platform.registerCoreModule('platform-language', platform.language);

            platform.onready();
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
            platform.debug('error ocurred');

            throw error;
        } else {
            platform.debug('call setup');

            setup();
        }
    });
})();
