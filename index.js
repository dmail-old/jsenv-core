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
    var provide = engine.provide;

    provide(function provideAgent() {
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

    provide(function provideGlobal() {
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

    provide(function provideVersion() {
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

    provide(function providePlatform() {
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

    provide(function provideLocationData() {
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
    });

    provide(function provideImport() {
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
    });

    provide(function provideLogger() {
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

    provide(function provideTask() {
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

    provide(function provideMainTask() {
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

    provide(function providePlugin() {
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

    config('language', function() {
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

    plugin('url').skipIf(function() {
        if ('URL' in engine.global) {
            return 'not needed';
        }
    });

    plugin('url-search-params').skipIf(function() {
        if ('URLSearchParams' in engine.global) {
            return 'not needed';
        }
    });

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

    config('locate-main', function() {
        engine.mainLocation = engine.locate(engine.mainLocation);
    });

    plugin('set-immediate').skipIf(function() {
        if ('setImmediate' in engine.global) {
            return 'not needed';
        }
    });

    plugin('promise').skipIf(function() {
        // always load my promise polyfill because some Promise implementation does not provide
        // unhandledRejection

        if ('Promise' in engine.global) {
            // test if promise support unhandledrejection hook, if so just dont load promise
            // this test is async and involves detecting for browser or node dependening on platform, ignore for now
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

            return System;
        }
    });

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
