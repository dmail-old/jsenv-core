/* eslint-env browser, node */

/*
WARNING : if your env does not support promise you must provide a polyfill before calling engine.start()

after including this file you can do

engine.config(function() {}); // function or file executed in serie before engine.mainTask
engine.run(function() {}); // function or file executed in serie after engine.mainTask
engine.importMain('./path/to/file.js'); // set engine.mainTask to import/execute this file then auto call engine.start
*/

(function() {
    var engine = {};
    // engine.provide adds functionnality to engine object
    // it can be called anywhere but it makes more sense to call it as soon as possible to provide functionalities asap
    engine.provide = function(data) {
        var properties = typeof data === 'function' ? data() : data;

        if (properties) {
            for (var key in properties) { // eslint-disable-line
                engine[key] = properties[key];
            }
        }
    };

    [
        function version() {
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
        },

        function platform() {
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

            return {
                platform: platform
            };
        },

        function agent() {
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
        },

        function global() {
            var globalValue;

            if (engine.isBrowser()) {
                globalValue = window;
            } else if (engine.isNode()) {
                globalValue = global;
            }

            globalValue.engine = engine;

            return {
                global: globalValue
            };
        },

        function location() {
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

            engine.location will be renamed internalLocation
            engine.baseURL will be renamed location

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
        },

        function include() {
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

            return {
                import: importMethod
            };
        },

        function language() {
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

            return {
                language: language
            };
        },

        function logger() {
            return {
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
            };
        }
    ].forEach(function(method) {
        engine.provide(method);
    });

    // https://github.com/YuzuJS/setImmediate
    function polyfillSetImmediate(global) {
        if ('setImmediate' in global) {
            return;
        }

        var nextHandle = 1; // Spec says greater than zero
        var tasksByHandle = {};
        var currentlyRunningATask = false;
        var doc = global.document;
        var setImmediate;

        function addFromSetImmediateArguments(args) {
            tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
            return nextHandle++;
        }

        // This function accepts the same arguments as setImmediate, but
        // returns a function that requires no arguments.
        function partiallyApplied(handler) {
            var args = [].slice.call(arguments, 1);
            return function() {
                if (typeof handler === "function") {
                    handler.apply(undefined, args);
                } else {
                    (new Function(String(handler)))(); // eslint-disable-line no-new-func
                }
            };
        }

        function runIfPresent(handle) {
            // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
            // So if we're currently running a task, we'll need to delay this invocation.
            if (currentlyRunningATask) {
                // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
                // "too much recursion" error.
                setTimeout(partiallyApplied(runIfPresent, handle), 0);
            } else {
                var task = tasksByHandle[handle];
                if (task) {
                    currentlyRunningATask = true;
                    try {
                        task();
                    } finally {
                        clearImmediate(handle);
                        currentlyRunningATask = false;
                    }
                }
            }
        }

        function clearImmediate(handle) {
            delete tasksByHandle[handle];
        }

        function installNextTickImplementation() {
            setImmediate = function() {
                var handle = addFromSetImmediateArguments(arguments);
                process.nextTick(partiallyApplied(runIfPresent, handle));
                return handle;
            };
        }

        function canUsePostMessage() {
            // The test against `importScripts` prevents this implementation from being installed inside a web worker,
            // where `global.postMessage` means something completely different and can't be used for this purpose.
            if (global.postMessage && !global.importScripts) {
                var postMessageIsAsynchronous = true;
                var oldOnMessage = global.onmessage;
                global.onmessage = function() {
                    postMessageIsAsynchronous = false;
                };
                global.postMessage("", "*");
                global.onmessage = oldOnMessage;
                return postMessageIsAsynchronous;
            }
        }

        function installPostMessageImplementation() {
            // Installs an event handler on `global` for the `message` event: see
            // * https://developer.mozilla.org/en/DOM/window.postMessage
            // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

            var messagePrefix = "setImmediate$" + Math.random() + "$";
            var onGlobalMessage = function(event) {
                if (event.source === global &&
                    typeof event.data === "string" &&
                    event.data.indexOf(messagePrefix) === 0) {
                    runIfPresent(Number(event.data.slice(messagePrefix.length)));
                }
            };

            if (global.addEventListener) {
                global.addEventListener("message", onGlobalMessage, false);
            } else {
                global.attachEvent("onmessage", onGlobalMessage);
            }

            setImmediate = function() {
                var handle = addFromSetImmediateArguments(arguments);
                global.postMessage(messagePrefix + handle, "*");
                return handle;
            };
        }

        function installMessageChannelImplementation() {
            var channel = new global.MessageChannel();
            channel.port1.onmessage = function(event) {
                var handle = event.data;
                runIfPresent(handle);
            };

            setImmediate = function() {
                var handle = addFromSetImmediateArguments(arguments);
                channel.port2.postMessage(handle);
                return handle;
            };
        }

        function installReadyStateChangeImplementation() {
            var html = doc.documentElement;
            setImmediate = function() {
                var handle = addFromSetImmediateArguments(arguments);
                // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
                // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
                var script = doc.createElement("script");
                script.onreadystatechange = function() {
                    runIfPresent(handle);
                    script.onreadystatechange = null;
                    html.removeChild(script);
                    script = null;
                };
                html.appendChild(script);
                return handle;
            };
        }

        function installSetTimeoutImplementation() {
            setImmediate = function() {
                var handle = addFromSetImmediateArguments(arguments);
                setTimeout(partiallyApplied(runIfPresent, handle), 0);
                return handle;
            };
        }

        // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
        var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
        attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

        if (engine.isNode()) {
            // For Node.js before 0.9
            installNextTickImplementation();
        } else if (canUsePostMessage()) {
            // For non-IE10 modern browsers
            installPostMessageImplementation();
        } else if (global.MessageChannel) {
            // For web workers, where supported
            installMessageChannelImplementation();
        } else if (doc && "onreadystatechange" in doc.createElement("script")) {
            // For IE 6–8
            installReadyStateChangeImplementation();
        } else {
            // For older browsers
            installSetTimeoutImplementation();
        }

        attachTo.setImmediate = setImmediate;
        attachTo.clearImmediate = clearImmediate;
    }

    function polyfillPromise(global) {
        function hasPromise() {
            if (('Promise' in engine.global) === false) {
                return false;
            }
            // agent must implement onunhandledrejection to consider promise implementation valid
            if (engine.isBrowser()) {
                if ('onunhandledrejection' in engine.global) {
                    return true;
                }
                return false;
            } else if (engine.isNode()) {
                // node version > 0.12.0 got the unhandledRejection hook
                // this way to detect feature is AWFUL but for now let's do this
                return engine.agent.version.major > 0 || engine.agent.version.minor > 12;
            }
            return false;
        }

        if (hasPromise()) {
            return;
        }

        function emitUnhandledOnBrowser(value, promise) {
            // https://googlechrome.github.io/samples/promise-rejection-events/
            if (window.onunhandledrejection) {
                window.onunhandledrejection({
                    promise: promise,
                    reason: value
                });
            } else {
                console.log('possibly unhandled rejection "' + value + '" for promise', promise);
            }
        }

        function emitUnhandledOnNode(value, promise) {
            if (process.listeners('unhandledRejection').length === 0) {
                var mess = value instanceof Error ? value.stack : value;
                console.log('possibly unhandled rejection "' + mess + '" for promise', promise);
            }
            process.emit('unhandledRejection', value, promise);
        }

        function emitHandledOnBrowser(value, promise) {
            if (window.onrejectionhandled) {
                window.onrejectionhandled({
                    promise: promise,
                    reason: value
                });
            }
        }

        function emitHandledOnNode(value, promise) {
            process.emit('rejectionHandled', promise);
        }

        var emitUnhandled = engine.isBrowser() ? emitUnhandledOnBrowser : emitUnhandledOnNode;
        var emitHandled = engine.isBrowser() ? emitHandledOnBrowser : emitHandledOnNode;

        function forOf(iterable, fn, bind) {
            var method;
            var iterator;
            var next;

            method = iterable[Symbol.iterator];

            if (typeof method !== 'function') {
                throw new TypeError(iterable + 'is not iterable');
            }

            if (typeof fn !== 'function') {
                throw new TypeError('second argument must be a function');
            }

            iterator = method.call(iterable);
            next = iterator.next();
            while (next.done === false) {
                try {
                    fn.call(bind, next.value);
                } catch (e) {
                    if (typeof iterator['return'] === 'function') { // eslint-disable-line dot-notation
                        iterator['return'](); // eslint-disable-line dot-notation
                    }
                    throw e;
                }
                next = iterator.next();
            }
        }

        function callThenable(thenable, resolve, reject) {
            var then;

            try {
                then = thenable.then;
                then.call(thenable, resolve, reject);
            } catch (e) {
                reject(e);
            }
        }

        function isThenable(object) {
            return object ? typeof object.then === 'function' : false;
        }

        var Promise = {
            executor: function() {},
            state: 'pending',
            value: null,
            pendingList: null,
            onResolve: null,
            onReject: null,

            constructor: function(executor) {
                if (arguments.length === 0) {
                    throw new Error('missing executor function');
                }
                if (typeof executor !== 'function') {
                    throw new TypeError('function expected as executor');
                }

                this.state = 'pending';
                this.resolver = this.resolve.bind(this);
                this.rejecter = this.reject.bind(this);

                if (executor !== this.executor) {
                    try {
                        executor(this.resolver, this.rejecter);
                    } catch (e) {
                        this.reject(e);
                    }
                }
            },

            toString: function() {
                return '[object Promise]';
            },

            createPending: function(onResolve, onReject) {
                var promise = new this.constructor(this.executor);
                promise.onResolve = onResolve;
                promise.onReject = onReject;
                return promise;
            },

            adoptState: function(promise) {
                var isResolved;
                var fn;
                var value;
                var ret;
                var error;

                value = promise.value;
                isResolved = promise.state === 'fulfilled';
                fn = isResolved ? this.onResolve : this.onReject;

                if (fn !== null && fn !== undefined) {
                    try {
                        ret = fn(value);
                    } catch (e) {
                        error = e;
                    }

                    if (error) {
                        isResolved = false;
                        value = error;
                    } else {
                        isResolved = true;
                        value = ret;
                    }
                }

                if (isResolved) {
                    this.resolve(value);
                } else {
                    this.reject(value);
                }
            },

            addPending: function(promise) {
                this.pendingList = this.pendingList || [];
                this.pendingList.push(promise);
            },

            startPending: function(pending) {
                pending.adoptState(this);
            },

            // called when the promise is settled
            clean: function() {
                if (this.pendingList) {
                    this.pendingList.forEach(this.startPending, this);
                    this.pendingList = null;
                }
            },

            onFulFilled: function(/* value */) {
                this.clean();
            },

            onRejected: function(value) {
                this.clean();

                // then() never called
                if (!this.handled) {
                    this.unhandled = global.setImmediate(function() {
                        this.unhandled = null;
                        if (!this.handled) { // then() still never called
                            this.unhandledEmitted = true;
                            this.unhandledReasonEmitted = true;
                            emitUnhandled(value, this);
                        }
                    }.bind(this));
                }
            },

            resolvedValueResolver: function(value) {
                if (isThenable(value)) {
                    if (value === this) {
                        this.reject(new TypeError('A promise cannot be resolved with itself'));
                    } else {
                        callThenable(value, this.resolver, this.rejecter);
                    }
                } else {
                    this.state = 'fulfilled';
                    this.resolving = false;
                    this.value = value;
                    this.onFulFilled(value);
                }
            },

            resolve: function(value) {
                if (this.state === 'pending') {
                    if (!this.resolving) {
                        this.resolving = true;
                        this.resolver = this.resolvedValueResolver.bind(this);
                        this.resolver(value);
                    }
                }
            },

            reject: function(value) {
                if (this.state === 'pending') {
                    this.state = 'rejected';
                    this.value = value;
                    this.onRejected(value);
                }
            },

            then: function(onResolve, onReject) {
                if (onResolve && typeof onResolve !== 'function') {
                    throw new TypeError('onResolve must be a function ' + onResolve + ' given');
                }
                if (onReject && typeof onReject !== 'function') {
                    throw new TypeError('onReject must be a function ' + onReject + ' given');
                }

                var pending = this.createPending(onResolve, onReject);

                this.handled = true;

                if (this.state === 'pending') {
                    this.addPending(pending);
                } else {
                    global.setImmediate(function() {
                        this.startPending(pending);
                    }.bind(this));

                    if (this.unhandledEmitted) {
                        emitHandled(this.unhandledReasonEmitted, this);
                    } else if (this.unhandled) {
                        global.clearImmediate(this.unhandled);
                        this.unhandled = null;
                    }
                }

                return pending;
            },

            catch: function(onreject) {
                return this.then(null, onreject);
            }
        };

        // make all properties non enumerable this way Promise.toJSON returns {}
        /*
        [
            'value',
            'state',
            'pendingList',
            //'onResolve',
            //'onReject',
            'pendingList',
            //'resolver',
            //'rejecter',
            //'unhandled',
            //'resolving',
            //'handled'
        ].forEach(function(name){
            Object.defineProperty(Promise, name, {enumerable: false, value: Promise[name]});
        });
        */

        Promise.constructor.prototype = Promise;
        Promise = Promise.constructor;

        // que fait-on lorsque value est thenable?
        Promise.resolve = function(value) {
            if (arguments.length > 0) {
                if (value instanceof this && value.constructor === this) {
                    return value;
                }
            }

            return new this(function resolveExecutor(resolve) {
                resolve(value);
            });
        };

        Promise.reject = function(value) {
            return new this(function rejectExecutor(resolve, reject) {
                reject(value);
            });
        };

        Promise.all = function(iterable) {
            return new this(function allExecutor(resolve, reject) {
                var index = 0;
                var length = 0;
                var values = [];
                var res = function(value, index) {
                    if (isThenable(value)) {
                        callThenable(value, function(value) {
                            res(value, index);
                        }, reject);
                    } else {
                        values[index] = value;
                        length--;
                        if (length === 0) {
                            resolve(values);
                        }
                    }
                };

                forOf(iterable, function(value) {
                    length++;
                    res(value, index);
                    index++;
                });

                if (length === 0) {
                    resolve(values);
                }
            });
        };

        Promise.race = function(iterable) {
            return new this(function(resolve, reject) {
                forOf(iterable, function(thenable) {
                    thenable.then(resolve, reject);
                });
            });
        };

        // prevent Promise.resolve from being call() or apply() just like chrome does
        ['resolve', 'reject', 'race', 'all'].forEach(function(name) {
            Promise[name].call = null;
            Promise[name].apply = null;
        });

        Promise.polyfill = true;
    }

    polyfillSetImmediate(engine.global);
    polyfillPromise(engine.global);

    // now we'll just load url polyfill
    // concerning url-search-params it will be part of the location that will be user right after to manage location
    // but url may need the location stuff ? for now just ignore that and build location ignoring the url implementation details
    // so the URL polyfill will be inlined like others
    // once this is done we will provide location
    // then system
    // then we can enjoy the true power of a solid js environment so we provide tasks, and plugins to manage startup
    // and the first plugin is es6 polyfill (core-js) that will be loaded by systemjs (let's hope babel will not polyfill before us)

    /*
    // inline this
    plugin('url').skipIf(function() {
        if ('URL' in engine.global) {
            return 'not needed';
        }
    });
    */

    /*
    // this will be part of location object
    config('locate', function() {
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

            locateFromRoot: function(location) {
                return this.locateFrom(location, this.location, true);
            }
        });
    });

    config('locate-main', function() {
        engine.mainLocation = engine.locate(engine.mainLocation);
    });
    */

    // now load system, couldn't we just document.write the script to prevent execution?
    // no we'll just load every script using promise
    plugin('system', {
        locate: function() {
            var systemLocation;

            if (engine.isBrowser()) {
                systemLocation = 'node_modules/systemjs/dist/system.js';
            } else {
                systemLocation = 'node_modules/systemjs/index.js';
            }

            return engine.dirname + '/' + systemLocation;
        },

        after: function(System) {
            engine.import = System.import.bind(System);

            System.transpiler = 'babel';
            System.babelOptions = {};
            System.paths.babel = engine.dirname + '/node_modules/babel-core/browser.js';

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

            if (engine.isNode()) {
                // already done via @node/fs LOOOOOOL
                // https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L1695
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

            return System;
        }
    });

    plugin('es6', {
        locate: function() {
            var polyfillLocation;

            if (engine.isBrowser()) {
                polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
            } else {
                polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';
            }

            return engine.dirname + '/' + polyfillLocation;
        }
    });

    engine.provide(function task() {
        var Task = function() {
            if (arguments.length === 1) {
                this.populate(arguments[0]);
            } else if (arguments.length === 2) {
                this.name = arguments[0];
                this.populate(arguments[1]);
            }
        };

        Task.prototype = {
            dependencies: [], // should check that taks dependencies have been executed before executing this one
            name: undefined,
            skipped: false,
            disabled: false,
            ended: false,
            next: null,

            populate: function(properties) {
                if (typeof properties === 'object') {
                    for (var key in properties) { // eslint-disable-line
                        this[key] = properties[key];
                    }
                } else if (typeof properties === 'function') {
                    this.fn = properties;
                    if (this.hasOwnProperty('name') === false) {
                        this.name = this.fn.name;
                    }
                }
            },

            skipIf: function(getSkipReason) {
                this.getSkipReason = getSkipReason;
                return this;
            },

            enable: function() {
                this.disabled = false;
            },

            disable: function() {
                this.disabled = true;
            },

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

            locate: function() {
                var location;
                if (this.url) {
                    location = engine.locate(this.url);
                } else {
                    location = engine.locate(this.name);
                }
                return location;
            },

            locateHook: function() {
                return Promise.resolve(this.locate()).then(function(location) {
                    this.location = location;
                    return location;
                }.bind(this));
            },

            import: function() {
                return this.locateHook().then(function(location) {
                    engine.debug('importing', location);
                    return engine.import(location);
                });
            },

            exec: function(value) {
                if (this.hasOwnProperty('fn') === false) {
                    return this.import();
                }
                return this.fn(value);
            },

            before: function(value) {
                return value;
            },

            after: function(value) {
                return value;
            },

            start: function(value) {
                // engine.info(engine.type, engine.location, engine.baseURL);
                engine.task = this;
                engine.debug('start task', this.name);

                return Promise.resolve(value).then(
                    this.before.bind(this)
                ).then(function(resolutionValue) {
                    if (this.disabled) {
                        this.skip('disabled');
                    } else {
                        var skipReason = this.getSkipReason();
                        if (skipReason) {
                            this.skip(skipReason);
                        }
                    }

                    if (this.skipped) {
                        return resolutionValue;
                    }
                    return this.exec(resolutionValue);
                }.bind(this)).then(function(resolutionValue) {
                    this.ended = true;
                    return this.after(resolutionValue);
                }.bind(this)).then(function(resolutionValue) {
                    if (this.next) {
                        // will throw but it will be ignored
                        return this.next.start(value);
                    }
                    return resolutionValue;
                }.bind(this));
            }
        };

        var noop = function() {};
        var headTask = new Task('head', noop);
        var tailTask = new Task('tail', noop);

        headTask.chain(tailTask);

        var tasks = {
            head: headTask,
            tail: tailTask,

            get: function(taskName) {
                var task = this.head;

                while (task) {
                    if (task.name === taskName) {
                        break;
                    } else {
                        task = task.next;
                    }
                }

                return task;
            },

            enable: function(taskName) {
                return this.get(taskName).enable();
            },

            disable: function(taskName) {
                return this.get(taskName).disabled();
            },

            add: function(task) {
                return this.head.chain(task);
            },

            insert: function(task, beforeTask) {
                return this.head.insert(task, beforeTask);
            },

            create: function(firstArg, secondArg) {
                return new Task(firstArg, secondArg);
            }
        };

        return {
            tasks: tasks
        };
    });

    engine.provide(function mainTask() {
        var mainTask = engine.tasks.create('main', function() {
            var mainModulePromise;

            if (engine.mainSource) {
                engine.debug('get mainModule from source string');
                mainModulePromise = System.module(engine.mainSource, {
                    address: engine.mainLocation
                });
            } else if (engine.mainModule) {
                engine.debug('get mainModule from source object');
                engine.mainModule = System.newModule(engine.mainModule);
                System.set(engine.mainLocation, engine.mainModule);
                mainModulePromise = Promise.resolve(engine.mainModule);
            } else {
                engine.debug('get mainModule from source file', engine.mainLocation);
                mainModulePromise = System.import(engine.mainLocation);
            }

            return mainModulePromise.then(function(mainModule) {
                engine.mainModule = mainModule;
                return mainModule;
            });
        });

        return {
            mainTask: mainTask,

            config: function() {
                var task = engine.tasks.create.apply(null, arguments);
                return engine.tasks.insert(task, mainTask);
            },

            run: function() {
                var task = engine.tasks.create.apply(null, arguments);
                return engine.tasks.add(task);
            },

            evalMain: function(source, sourceURL) {
                this.mainSource = source;
                this.mainLocation = sourceURL || './anonymous';
                return this.start();
            },

            exportMain: function(moduleExports) {
                // seems strange to pass an object because this object will not benefit
                // from any polyfill/transpilation etc
                this.mainModule = moduleExports;
                this.mainLocation = './anonymous';
                return this.start();
            },

            importMain: function(moduleLocation) {
                this.mainLocation = moduleLocation;
                return this.start();
            },

            start: function() {
                if (!this.mainLocation) {
                    throw new Error('mainLocation must be set before calling engine.start()');
                }

                return engine.tasks.head.start().then(function() {
                    return engine.mainModule;
                });
            }
        };
    });

    engine.provide(function plugin() {
        return {
            plugin: function(name, properties) {
                var task = engine.config(name);
                task.locate = function() {
                    return engine.dirname + '/plugins/' + this.name + '/index.js';
                };
                task.populate(properties);
                return task;
            }
        };
    });

    var config = engine.config;
    // var run = engine.run;
    var plugin = engine.plugin;

    // we wait for promise, & system before adding exceptionHandler
    plugin('exception-handler');

    plugin('module-internal');

    plugin('module-source');

    plugin('module-script-name');

    plugin('module-source-transpiled');

    plugin('module-sourcemap');

    plugin('agent-config', {
        locate: function() {
            return engine.dirname + '/plugins/agent-' + engine.agent.type + '/index.js';
        }
    });

    plugin('module-test');
})();
