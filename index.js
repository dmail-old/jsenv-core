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

        build(function implementation() {
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
            implementation.support = function(featureName, featureVersion) {
                if (arguments.length === 1) {
                    featureVersion = '*';
                }
                var feature = this.get(featureName);
                if (feature === null) {
                    // unknown feature
                    return false;
                }
                var version = feature.get(featureVersion);
                if (version === null) {
                    // unknown version
                    return false;
                }
                return version.test();
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

            var env = this;
            function FeatureVersion(version) {
                this.version = env.createVersion(version);
            }
            var featureVersionProto = FeatureVersion.prototype;
            featureVersionProto.match = function(version) {
                return this.version.match(version);
            };
            featureVersionProto.test = function() {
                var detector = this.detector;
                if (detector) {
                    return Boolean(detector());
                }
                return false;
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

        build(function prepareImplementationDetection() {
            var implementation = jsenv.implementation;
            // var hyphenToCamel = jsenv.hyphenToCamel;
            var camelToHypen = function(string) {
                string = string.replace(/_/g, '-');
                // s'il n'y a que des char uppercase et des -
                // ne met juste en lower case
                var i = 0;
                var j = string.length;
                var everyLetterIsDashOrUpperCase = true;
                while (i < j) {
                    var letter = string[i];
                    if (letter !== '-' && letter !== letter.toUpperCase()) {
                        everyLetterIsDashOrUpperCase = false;
                        break;
                    }
                    i++;
                }
                if (everyLetterIsDashOrUpperCase) {
                    return string.toLowerCase();
                }
                return jsenv.camelToHypen(string).toLowerCase();
            };

            function partialLeft(fn) {
                var leftArgs = [];
                var i = 1;
                var j = arguments.length;
                while (i < j) {
                    leftArgs.push(arguments[i]);
                    i++;
                }
                return function() {
                    var fullArgs = [];
                    fullArgs.push.apply(fullArgs, leftArgs);
                    fullArgs.push.apply(fullArgs, arguments);
                    return fn.apply(this, fullArgs);
                };
            }
            function detect(featureName, detector) {
                implementation.add(featureName).detect(detector);
            }
            function detectIf(featureName, ifFeatureName, detector) {
                implementation.add(featureName).detect(function() {
                    return (
                        implementation.support(ifFeatureName) &&
                        detector()
                    );
                });
            }
            function detectMany(detection, object, prefix) {
                var i = 3;
                var j = arguments.length;
                var features = [];
                while (i < j) {
                    var detectionName = arguments[i];
                    var hyphenatedDetectionName = camelToHypen(detectionName);
                    var featureName;
                    if (prefix) {
                        featureName = prefix + '-' + hyphenatedDetectionName;
                    } else {
                        featureName = hyphenatedDetectionName;
                    }
                    var feature = implementation.add(featureName);
                    detection(feature, object, detectionName);
                    features.push(feature);
                    i++;
                }
                return features;
            }
            var detectMethods = partialLeft(detectMany, function(feature, object, methodName) {
                feature.detectMethod(object, methodName);
            });
            var detectPresence = partialLeft(detectMany, function(feature, object, propertyName) {
                feature.detect(function() {
                    return propertyName in object;
                });
            });
            var detectNumbers = partialLeft(detectMany, function(feature, object, numberName) {
                feature.detect(function() {
                    return typeof object[numberName] === 'number';
                });
            });
            var detectGlobalMethods = partialLeft(detectMethods, jsenv.global, '');

            // Object
            detect('object-to-string', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/master/modules/es6.object.to-string.js
                return false;
            });
            detectMethods(Object, 'object',
                // es6
                'assign',
                'is',
                'setPrototypeOf',
                'freeze',
                'seal',
                'preventExtensions',
                'isFrozen',
                'isSealed',
                'isExtensible',
                'getOwnPropertyDescriptor',
                'getPrototypeOf',
                'keys',
                'getOwnPropertyNames',
                // es7
                'values',
                'entries',
                '__defineSetter__',
                '__defineGetter__',
                '__lookupSetter__',
                '__lookupGetter__',
                'getOwnPropertyDescriptors'
            );

            // Function
            detect('function-name', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.function.name.js
                return false;
            });
            detectMethods(Function, 'function',
                'bind'
            );

            // Array
            detectMethods(Array, 'array',
                'from',
                'of',
                'copyWithin',
                'fill',
                'find',
                'findIndex',
                'isArray',
                'slice',
                'join',
                'indexOf',
                'lastIndexOf',
                'every',
                'some',
                'forEach',
                'map',
                'filter',
                'reduce',
                'reduceRight',
                'sort'
            );

            // String
            detectMethods(String.prototype, 'string',
                // es6
                'from-code-point',
                'codePointAt',
                'endsWith',
                'includes',
                'repeat',
                'startsWith',
                'trim',
                'anchor',
                'big',
                'blink',
                'bold',
                'fixed',
                'fontcolor',
                'fontsize',
                'italics',
                'link',
                'small',
                'strike',
                'sub',
                'sup',
                // es7
                'padStart',
                'padEnd',
                'trimStart',
                'trimEnd',
                'matchAll',
                'at'
            );
            detectMethods(String, 'string',
                'raw'
            );

            // RegExp
            detect('regexp-constructor', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.constructor.js
                return true;
            });
            detect('regexp-flags', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.flags.js
                return false;
            });

            // Number
            detect('number-constructor', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.number.constructor.js
                return false;
            });
            detectNumbers(Number, 'number',
                'epsilon',
                'MAX_SAFE_INTEGER',
                'MIN_SAFE_INTEGER'
            );
            detectMethods(Number, 'number',
                'isFinite',
                'isInteger',
                'isNaN',
                'isSafeInteger',
                'parseFloat',
                'parseInt'
            );
            detectMethods(Number.prototype, 'number',
                'toFixed',
                'toPrecision'
            );

            // Math
            detectMethods(Math, 'math',
                // es6
                'acosh',
                'asinh',
                'atanh',
                'cbrt',
                'clz32',
                'cosh',
                'expm1',
                'fround',
                'hypot',
                'imul',
                'log1p',
                'log10',
                'log2',
                'sign',
                'sinh',
                'tanh',
                'trunc',
                // es7
                'clamp',
                'degrees',
                'fscale',
                'radians',
                'scale',
                'iaddh',
                'isubh',
                'imulh',
                'umulh'
            );
            detectNumbers(Math, 'math',
                'DEG_PER_RAD',
                'RAD_PER_DEG'
            );

            // Date
            detect('date-to-iso-string', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
                return false;
            });
            detect('date-to-json', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
                return false;
            });
            detect('date-to-string', function() {
                // to be replaced with check of core-js
                // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
                return false;
            });
            detectMethods(Date, 'date',
                'now'
            );

            // Promise
            detect('promise', function() {
                return false;
                // if (('Promise' in jsenv.global) === false) {
                //     return false;
                // }
                // if (Promise.isPolyfill) {
                //     return true;
                // }
                // // agent must implement onunhandledrejection to consider promise implementation valid
                // if (jsenv.isBrowser()) {
                //     if ('onunhandledrejection' in jsenv.global) {
                //         return true;
                //     }
                //     return false;
                // }
                // if (jsenv.isNode()) {
                //     // node version > 0.12.0 got the unhandledRejection hook
                //     // this way to detect feature is AWFUL but for now let's do this
                //     if (jsenv.agent.version.major > 0 || jsenv.agent.version.minor > 12) {
                //         // apprently node 6.1.0 unhandledRejection is not great too, to be tested
                //         if (jsenv.agent.version.major === 6 && jsenv.agent.version.minor === 1) {
                //             return false;
                //         }
                //         return true;
                //     }
                //     return false;
                // }
                // return false;
            });

            // Symbol
            detectGlobalMethods('Symbol');
            detectPresence(implementation.support('symbol') ? Symbol : null, 'symbol',
                'hasInstance',
                'match',
                'replace',
                'search',
                'split',
                'toPrimitive',
                'iterator',
                'asyncIterator'
            );
            detectIf('function-has-instance', 'symbol-has-instance', function() {
                return Symbol.hasInstance in Function.prototype;
            });
            detectIf('regexp-match', 'symbol-match', function() {
                return Symbol.match in RegExp.prototype;
            });
            detectIf('regexp-replace', 'symbol-replace', function() {
                return Symbol.replace in RegExp.prototype;
            });
            detectIf('regexp-search', 'symbol-search', function() {
                return Symbol.search in RegExp.prototype;
            });
            detectIf('regexp-split', 'symbol-split', function() {
                return Symbol.split in RegExp.prototype;
            });
            detectIf('date-to-primitive', 'symbol-to-primitive', function() {
                return Symbol.toPrimitive in Date.prototype;
            });
            detectIf('array-iterator', 'symbol-iterator', function() {
                return Symbol.iterator in Array.prototype;
            });
            detectIf('string-iterator', 'symbol-iterator', function() {
                return Symbol.iterator in String.prototype;
            });
            detectIf('number-iterator', 'symbol-iterator', function() {
                return Symbol.iterator in Number.prototype;
            });

            detectGlobalMethods(
                'Map',
                'Set',
                'WeakMap',
                'WeakSet',
                'ArrayBuffer',
                'DataView',
                'Int8Array',
                'Uint8Array',
                'Uint8ClampedArray',
                'Int16Array',
                'Uint16Array',
                'Int32Array',
                'Uint32Array',
                'Float32Array',
                'Float64Array',
                'Observable',
                'asap'
            );

            // Reflect
            detect('reflect', function() {
                return typeof Reflect === 'object';
            });
            detectMethods(implementation.support('reflect') ? Reflect : null, 'reflect',
                'defineMetadata',
                'getMetadata',
                'getOwnMetadata',
                'hasMetadata',
                'hasOwnMetadata',
                'deleteMetadata',
                'getMetadataKeys',
                'getOwnMetadataKeys',
                'metadata'
            );

            // es7
            // https://github.com/zloirock/core-js#stage-4-proposals
            detect('es7-array-includes', function() {
                return false;
            });

            detectGlobalMethods(
                'setTimeout',
                'setInterval',
                'setImmediate'
            );

            detect('dom-iterable', function() {
                // to be added if any of NodeList, DOMTokenList, MediaList, StyleSheetList, CSSRuleList
                // has not any of keys, values, entries and @@iterator
                return false;
            });
        });

        build(function compareRequirementWithDetectedImplementation() {
            var requirements = [
                'object-to-string',
                'object-assign',
                'object-is',
                'object-set-prototype-of',
                'object-freeze',
                'object-seal',
                'object-prevent-extensions',
                'object-is-frozen',
                'object-is-sealed',
                'object-is-extensible',
                'object-get-own-property-descriptor',
                'object-get-prototype-of',
                'object-keys',
                'object-get-own-property-names',
                // es7
                'object-values',
                'object-entries',
                'object---define-setter--',
                'object---define-getter--',
                'object---lookup-setter--',
                'object---lookup-getter--',
                'object-get-own-property-descriptors',

                'function-name',
                'function-bind',
                'function-has-instance',

                'array-from',
                'array-of',
                'array-copy-within',
                'array-fill',
                'array-find',
                'array-find-index',
                'array-is-array',
                'array-slice',
                'array-join',
                'array-index-of',
                'array-last-index-of',
                'array-every',
                'array-some',
                'array-for-each',
                'array-map',
                'array-filter',
                'array-reduce',
                'array-reduce-right',
                'array-sort',
                'array-iterator',

                'string-from-code-point',
                'string-raw',
                'string-code-point-at',
                'string-ends-with',
                'string-includes',
                'string-repeat',
                'string-starts-with',
                'string-trim',
                'string-anchor',
                'string-big',
                'string-blink',
                'string-bold',
                'string-fixed',
                'string-fontcolor',
                'string-fontsize',
                'string-italics',
                'string-link',
                'string-small',
                'string-strike',
                'string-sub',
                'string-sup',
                'string-iterator',
                // es7
                'string-pad-start',
                'string-pad-end',
                'string-trim-start',
                'string-trim-end',
                'string-match-all',
                'string-at',

                'regexp-constructor',
                'regexp-flags',
                'regexp-match',
                'regexp-replace',
                'regexp-search',
                'regexp-split',

                'number-constructor',
                'number-epsilon',
                'number-max-safe-integer',
                'number-min-safe-integer',
                'number-is-finite',
                'number-is-integer',
                'number-is-na-n',
                'number-is-safe-integer',
                'number-parse-float',
                'number-parse-int',
                'number-to-fixed',
                'number-to-precision',
                'number-iterator',

                // es6
                'math-acosh',
                'math-asinh',
                'math-atanh',
                'math-cbrt',
                'math-clz32',
                'math-cosh',
                'math-expm1',
                'math-fround',
                'math-hypot',
                'math-imul',
                'math-log1p',
                'math-log10',
                'math-log2',
                'math-sign',
                'math-sinh',
                'math-tanh',
                'math-trunc',
                // es7
                'math-clamp',
                'math-degrees',
                'math-fscale',
                'math-radians',
                'math-scale',
                'math-iaddh',
                'math-isubh',
                'math-imulh',
                'math-umulh',
                'math-deg-per-rad',
                'math-rad-per-deg',

                'date-to-iso-string',
                'date-to-json',
                'date-to-string',
                'date-now',
                'date-to-primitive',

                'map',
                'set',
                'weak-map',
                'weak-set',
                'array-buffer',
                'data-view',
                'int8array',
                'uint8array',
                'uint8clamped-array',
                'int16array',
                'uint16array',
                'int32array',
                'uint32array',
                'float32array',
                'float64array',
                'observable',
                'promise',

                'set-timeout',
                'set-interval',
                'set-immediate',
                'asap',

                'symbol',
                'symbol-has-instance',
                'symbol-match',
                'symbol-replace',
                'symbol-search',
                'symbol-split',
                'symbol-to-primitive',
                'symbol-iterator',
                'symbol-async-iterator',

                'reflect',
                'reflect-define-metadata',
                'reflect-get-metadata',
                'reflect-get-own-metadata',
                'reflect-has-metadata',
                'reflect-has-own-metadata',
                'reflect-delete-metadata',
                'reflect-get-metadata-keys',
                'reflect-get-own-metadata-keys',
                'reflect-metadata',

                'es7-array-includes',
                'dom-iterable'
            ];

            function detectImplementationStatus() {
                var requirementsStatus = {};
                var i = 0;
                var j = requirements.length;
                while (i < j) {
                    var requirementName = requirements[i];
                    var requirementStatus;
                    if (jsenv.implementation.support(requirementName)) {
                        requirementStatus = 'ok';
                    } else {
                        requirementStatus = 'missing';
                    }
                    // j'imaerais bien qu'en fait mon détecteur
                    // ah et aussi au lieu de missing 'unkown'
                    // genre quand le requirement n'existe pas dans la liste
                    // des features qu'on connait
                    // permette un troisième type de status genre 'partial' ou 'incorrect' ou 'bugged'
                    // qui signifique qu'on a une feature mais qu'elle ne fonctionne pas comme attendu
                    // c'est quelque chose de fréquent et les polyfill servent aussi à ça
                    requirementsStatus[requirementName] = requirementStatus;
                    i++;
                }

                return requirementsStatus;
            }

            return {
                detectImplementationStatus: detectImplementationStatus
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
        /* require('core-js-builder')({
  modules: ['es6', 'core.dict'], // modules / namespaces
  blacklist: ['es6.reflect'],    // blacklist of modules / namespaces, by default - empty list
  library: false,                // flag for build without global namespace pollution, by default - false
  umd: true                      // use UMD wrapper for export `core` object, by default - true
}).then(code => {
  // ...
}).catch(error => {
  // ...
});
*/
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

    // list requirements amongst setimmediate, promise, url, url-search-params, es6 polyfills & SystemJS
    var files = listFiles(jsenv);
    includeFiles(jsenv, files, function() {
        jsenv.SystemPrototype = jsenv.global.System;
        delete jsenv.global.System; // remove System from the global scope
        jsenv.constructor();
    });
})();
