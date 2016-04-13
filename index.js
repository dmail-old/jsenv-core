/* eslint-env browser, node */

/*
after including this file you can do

engine.config(function() {}); // function or file executed in serie before engine.mainTask
engine.run(function() {}); // function or file executed in serie after engine.mainTask
engine.importMain('./path/to/file.js'); // set engine.mainTask to import/execute this file then auto call engine.start
*/

(function() {
    var engine = {};
    // engine.provide adds properties to the engine object and can be called anywhere
    engine.provide = function(data) {
        var properties;

        if (typeof data === 'function') {
            console.log('provide', data.name);
            properties = data.call(engine);
        } else {
            properties = data;
        }

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

        function globalProvider() {
            var globalValue;

            if (this.isBrowser()) {
                globalValue = window;
            } else if (this.isNode()) {
                globalValue = global;
            }

            globalValue.engine = this;

            return {
                global: globalValue
            };
        },

        function baseAndInternalURL() {
            var baseURL;
            var internalURL;
            var clean;
            var parentPath;

            parentPath = function(path) {
                return path.slice(0, path.lastIndexOf('/'));
            };

            if (this.isBrowser()) {
                clean = function(path) {
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
                internalURL = clean(__filename);
            }

            return {
                baseURL: baseURL, // from where am I running system-run
                internalURL: internalURL, // where is this file
                dirname: parentPath(internalURL), // dirname of this file
                cleanPath: clean,
                parentPath: parentPath
            };
        },

        /*
        DEPRECATED (not used anymore)
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
        */

        /*
        DEPRECATED (will certainly be moved into a plugin)
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
        */

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

    var setup = (function() {
        function hasSetImmediate() {
            return 'setImmediate' in engine.global;
        }

        function hasPromise() {
            if (('Promise' in engine.global) === false) {
                return false;
            }
            if (Promise.isPolyfill) {
                return true;
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

        function hasURL() {
            return 'URL' in engine.global;
        }

        var fileToLoad = [];
        if (hasSetImmediate() === false) {
            fileToLoad.push('lib/set-immediate/index.js');
        }
        if (hasPromise() === false) {
            fileToLoad.push('lib/promise/index.js');
        }
        if (hasURL() === false) {
            fileToLoad.push('lib/url/index.js');
        }

        if (engine.isBrowser()) {
            fileToLoad.push('node_modules/systemjs/dist/system.js');
        } else {
            fileToLoad.push('node_modules/systemjs/index.js');
        }

        function includeAllBrowser(urls, callback) {
            var i = 0;
            var j = urls.length;
            var url;
            var loadCount = 0;

            window.includeLoaded = function() {
                loadCount++;
                if (loadCount === j) {
                    delete window.includeLoaded;
                    callback();
                }
            };

            for (;i < j; i++) {
                url = urls[i];
                var scriptSource;

                scriptSource = '<';
                scriptSource += 'script type="text/javascript" onload="includeLoaded()" src="';
                scriptSource += url;
                scriptSource += '">';
                scriptSource += '<';
                scriptSource += '/script>';

                document.write(scriptSource);
            }
        }

        function includeAllNode(urls, callback) {
            var i = 0;
            var j = urls.length;
            var url;
            for (;i < j; i++) {
                url = urls[i];
                if (url.indexOf('file:///') === 0) {
                    url = url.slice('file:///'.length);
                }

                engine.debug('include', url);
                require(url);
            }
            callback();
        }

        var includeAll = engine.isBrowser() ? includeAllBrowser : includeAllNode;

        fileToLoad = fileToLoad.map(function(filePath) {
            return engine.dirname + '/' + filePath;
        });

        return function setup(callback) {
            includeAll(fileToLoad, callback);
        };
    })();

    var init = function() {
        // setImmediate, Promise, URL, System are now available
        // url-search-params will be part of Location object that will certainly be defined here to be available everywhere
        // (even before any plugin but it's to be defined)
        // we must also provide es6 polyfills (Map, Set, Iterator, ...)
        // so here we only provide task & plugin API to be able to do engine.config(), engine.run(), engine.importMain()
        // and we add some default plugin like es6, Location, agent-config etc that user can later disable or add plugin before of after

        System.transpiler = 'babel';
        System.babelOptions = {};
        System.paths.babel = engine.dirname + '/node_modules/babel-core/browser.js';

        /*
        create an URLPath object that will parse a pathname into
        dirname, extname, basename, filename
        with resolve(otherPath) & relative(otherPath) methods
        */

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

        if (engine.isNode()) {
            // @node/fs etc available thanks to https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L1695
            registerCoreModule('@node/require', require);
        }

        engine.registerCoreModule = registerCoreModule;

        engine.provide(function location() {
            /*
            https://github.com/jden/url-relative/blob/master/index.js
            https://medialize.github.io/URI.js/about-uris.html
            https://github.com/Polymer/URL/blob/master/url.js
            https://gist.github.com/Yaffle/1088850
                           origin
                   __________|__________
                  /                     \
                                     authority
                 |             __________|_________
                 |            /                    \
                          userinfo                host                          resource
                 |         __|___                ___|___                 __________|___________
                 |        /      \              /       \               /                      \
                     username  password     hostname    port       pathname           search   hash
                 |     __|___   __|__    ______|______   |   __________|_________   ____|____   |
                 |    /      \ /     \  /             \ / \ /                    \ /         \ / \
                foo://username:password@www.example.com:123/hello/world/there.html?name=ferret#foo
                \_/                     \ / \ ___ / \ /    \__________/ \   / \  /
                 |                       /     |     |           |       \ /    /
              protocol         subdomain rootdomain tld      dirname basename suffix
                                               \____/                      \___/
                                                  |                          |
                                                domain                   filename
            */

            function Location(locationData, baseLocationData) {
                if (locationData instanceof locationData) {
                    return locationData;
                }

                // var url = new URL(locationData, baseLocationData);
            }

            var abstractions = {
                // abstraction level : 1
                domain: {
                    parts: ['rootDomain', 'tld'],
                    get: function(rootDomain, tld) {
                        var domain = '';

                        domain += rootDomain;
                        domain += '.' + tld;

                        return domain;
                    },

                    set: function(domain) {
                        return domain.split('.');
                    }
                },

                userinfo: {
                    parts: ['username', 'password'],
                    get: function(username, password) {
                        var userinfo = '';

                        if (username) {
                            userinfo += username;
                            if (password) {
                                userinfo += ':' + password;
                            }
                        }

                        return userinfo;
                    },

                    set: function(userinfo) {
                        return userinfo.split(':');
                    }
                },

                filename: {
                    parts: ['basename', 'suffix'],
                    get: function(basename, suffix) {
                        var filename = '';

                        if (basename) {
                            filename += basename;
                        }
                        if (suffix) {
                            filename += '.' + suffix;
                        }

                        return filename;
                    },

                    set: function(filename) {
                        return filename.split('.');
                    }
                },

                // abstraction level : 2
                hostname: {
                    parts: ['subdomain', 'domain'],
                    get: function(subdomain, domain) {
                        var hostname = '';

                        if (subdomain) {
                            hostname += subdomain + '.';
                        }
                        hostname += domain;

                        return hostname;
                    },

                    set: function(hostname) {
                        var dotIndex = hostname.indexof('.');
                        if (dotIndex > -1) {
                            return [hostname.slice(0, dotIndex), hostname.slice(dotIndex + 1)];
                        }
                        return ['', hostname];
                    }
                },

                pathname: {
                    parts: ['dirname', 'filename'],
                    get: function(dirname, filename) {
                        var pathname = '';

                        if (dirname) {
                            pathname += dirname;
                        }
                        if (filename) {
                            if (dirname) {
                                pathname += '/';
                            }
                            pathname += filename;
                        }

                        return pathname;
                    },

                    set: function(pathname) {
                        var segments = pathname.split('/');
                        var length = segments.length;

                        if (length === 0) {
                            return ['', ''];
                        }
                        if (length === 1) {
                            return ['', segments[0]];
                        }
                        return [segments.slice(0, -1).join('/'), segments[length - 1]];
                    }
                },

                // abstraction level : 3
                host: {
                    parts: ['hostname', 'port'],
                    get: function(hostname, port) {
                        var host = '';

                        host += hostname;
                        if (port) {
                            host += ':' + port;
                        }

                        return host;
                    },

                    set: function(host) {
                        return host.split(':');
                    }
                },

                ressource: {
                    parts: ['pathname', 'search', 'hash'],
                    get: function(pathname, search, hash) {
                        var ressource = '';

                        if (pathname) {
                            ressource += pathname;
                        }
                        if (search) {
                            ressource += '?' + search;
                        }
                        if (hash) {
                            ressource += '#' + hash;
                        }

                        return ressource;
                    },

                    set: function() {
                        var pathname = '';
                        var search = '';
                        var hash = '';

                        // it's a bit mroe complicated than others

                        return [pathname, search, hash];

                        /*
                        var questionCharIndex = ressource.indexOf('?');
                        if (questionCharIndex > -1) {
                            search = ressource.slice(questionCharIndex);
                        }
                        var dieseCharIndex = ressource.indexOf('#');
                        if (dieseCharIndex > -1) {
                            hash = ressource.slice(dieseCharIndex);
                        }
                        */
                    }
                },

                // abstraction level : 4
                authority: {
                    parts: ['userinfo', 'host'],
                    get: function(userinfo, host) {
                        var authority = '';

                        if (userinfo) {
                            authority += userinfo + '@';
                        }
                        authority += host;

                        return authority;
                    },

                    set: function(authority) {
                        return authority.split('@');
                    }
                },

                // abstraction level : 5
                origin: {
                    parts: ['protocol', 'authority'],
                    get: function(protocol, authority) {
                        var origin = '';

                        if (protocol) {
                            origin += protocol + '://';
                        }
                        if (authority) {
                            origin += authority;
                        }

                        return origin;
                    },

                    set: function(origin) {
                        var separation = '://';
                        var seprationIndex = origin.indexof(separation);
                        if (seprationIndex > -1) {
                            return [origin.slice(0, seprationIndex), origin.slice(seprationIndex + separation.length)];
                        }
                        return ['', origin];
                    }
                },

                // abstraction level : 6
                href: {
                    parts: ['origin', 'ressource'],
                    get: function(origin, ressource) {
                        var href = '';

                        href += origin;
                        if (ressource) {
                            href += '/' + ressource;
                        }

                        return href;
                    },

                    set: function(href) {
                        var url = new URL(href);

                        this.protocol = url.protocol;
                        this.username = url.username;
                        this.password = url.password;
                        this.hostname = url.hostname; // will auto split into subdomain, rootdomain, tld
                        this.port = url.port;
                        this.pathname = url.pathname; // will auto split into dirname, basename, suffix
                        this.search = url.search;
                        this.hash = url.hash; // we must instantiate a URLSearchParams from this.search
                    }
                }
            };

            Location.prototype = {
                protocol: null,
                username: null,
                password: null,
                subdomain: null,
                rootdomain: null,
                tld: null,
                port: null,
                dirname: null,
                filename: null,
                suffix: null,
                search: null,
                hash: null,

                toString() {
                    return this.href;
                }
            };

            Object.keys(abstractions).forEach(function(abstractionName) {
                var abstraction = abstractions[abstractionName];

                Object.defineProperty(Location.prototype, abstractionName, {
                    configurable: true,
                    writable: true,
                    enumerable: false,

                    get: function() {
                        var args = abstraction.parts.map(function(partName) {
                            return this[partName];
                        }, this);

                        return abstraction.get.apply(abstraction, args);
                    },

                    set: function(value) {
                        var partValues = abstraction.set(value);

                        partValues.forEach(function(partValue, index) {
                            this[abstraction.parts[index]] = partValue;
                        }, this);
                    }
                });
            });

            Location.prototype.resolve = function(locationData) {
                return new Location(locationData, this);
            };

            Location.prototype.relative = function(locationData) {
                var location = new Location(locationData, this);

                // tout ce qui est commun on ne précise pas, dès qu'on truc n'est pas commun on précise c'est plutôt ça
                // y'a pas que host c'est plutot origin
                if (this.origin !== location.origin) {
                    return location.toString();
                }
                // faut retourner une nouvelle location qui soit relative donc, mettre à jour this path en fait

                // left to right, look for closest common path segment
                var fromSegments = this.pathname.slice(1).split('/');
                var toSegments = location.pathname.slice(1).split('/');

                while (fromSegments[0] === toSegments[0]) {
                    fromSegments.shift();
                    toSegments.shift();
                }

                var length = fromSegments.length - toSegments.length;
                if (length > 0) {
                    while (length--) {
                        toSegments.unshift('..');
                    }
                } else if (length === 0) {
                    length = toSegments.length - 1;
                    while (length--) {
                        toSegments.unshift('..');
                    }
                }

                return toSegments.join('/');
            };
        });

        // this will be part of location object
        engine.provide(function locate() {
            return {
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
                    return this.locateFrom(location, this.internalURL, true);
                }
            };
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
                        } else if (this.hasOwnProperty('getSkipReason')) {
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

            var taskChain = {
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
                taskChain: taskChain
            };
        });

        engine.provide(function mainTask() {
            var mainTask = this.taskChain.create('main', function() {
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
                    engine.debug('mainModule imported', mainModule);
                    engine.mainModule = mainModule;
                    return mainModule;
                });
            });

            this.taskChain.insert(mainTask, this.taskChain.tail);

            return {
                mainTask: mainTask,

                config: function() {
                    var task = this.taskChain.create.apply(null, arguments);
                    return this.taskChain.insert(task, mainTask);
                },

                run: function() {
                    var task = this.taskChain.create.apply(null, arguments);
                    return this.taskChain.add(task);
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

                    return this.taskChain.head.start().then(function() {
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
    };

    setup(init);

    /*
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
    */
})();
