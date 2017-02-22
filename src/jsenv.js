/* globals jsenv */
/* eslint-env browser, node */
/* after including this file you can create your own env, (most time only one is enough) */

/*
concernant le nouveau fetch hook pour systemjs
apparement il faudrais modifier le hook instantiate
https://github.com/systemjs/systemjs/issues/1543#issuecomment-274036882

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

/*
Cette première partie sers à fournir une base commune autour d'un objet global appelé jsenv
On dispose de quelque informations relative à agent, platform, global, des urls aidant à savoir où on se trouve
ainsi que quelques utilitaires comme assign, Iterable et Predicate
*/
(function() {
    var jsenv = {};

    function assign(object, properties) {
        for (var key in properties) { // eslint-disable-line
            object[key] = properties[key];
        }
        return object;
    }
    function provide() {
        if (arguments.length > 1) {
            var value = arguments[1];
            jsenv[arguments[0]] = value;
        } else {
            var properties;
            if (typeof arguments[0] === 'function') {
                // console.log('build', data.name);
                properties = arguments[0].call(jsenv);
            } else {
                properties = arguments[0];
            }

            if (properties) {
                assign(jsenv, properties);
            }
        }
    }

    provide('provide', provide);
    provide('assign', assign);
    provide('options', {});
    provide('globalName', 'jsenv');
    provide('modulePrefix', '@jsenv');
    provide('rootModuleName', 'jsenv');
    provide('moduleName', 'env');
    provide(function construct() {
        var construct;
        if (typeof Reflect === 'object' && 'construct' in Reflect) {
            construct = Reflect.construct;
        } else {
            construct = function construct(Constructor, args) {
                var ConstructorProxy = function(args) {
                    return Constructor.apply(this, args);
                };
                ConstructorProxy.prototype = Constructor.prototype;
                var instance = new ConstructorProxy(args);
                ConstructorProxy.prototype = null;
                return instance;
            };
        }

        return {
            construct: construct
        };
    });
    provide(function version() {
        var anyChar = '*';
        var unspecifiedChar = '?';

        function VersionPart(value) {
            if (value === anyChar || value === unspecifiedChar) {
                this.value = value;
            } else if (isNaN(value)) {
                // I dont wanna new Version to throw
                // in the worst case you end with a version like '?.?.?' but not an error
                this.error = new Error('version part must be a number or * (not ' + value + ')');
                this.value = unspecifiedChar;
            } else {
                this.value = parseInt(value);
            }
        }
        VersionPart.prototype = {
            constructor: VersionPart,

            clone: function() {
                return new VersionPart(this.value);
            },

            isAny: function() {
                return this.value === anyChar;
            },

            isUnspecified: function() {
                return this.value === unspecifiedChar;
            },

            isSpecified: function() {
                return this.value !== unspecifiedChar;
            },

            isPrecise: function() {
                return this.isAny() === false && this.isSpecified();
            },

            match: function(value) {
                var other = VersionPart.cast(value);
                return (
                    this.isAny() ||
                    other.isAny() ||
                    this.value === other.value
                );
            },

            above: function(value) {
                var other = VersionPart.cast(value);
                return (
                    this.isPrecise() &&
                    other.isPrecise() &&
                    this.value > other.value
                );
            },

            below: function(value) {
                var other = VersionPart.cast(value);
                return (
                    this.isPrecise() &&
                    other.isPrecise() &&
                    this.value < other.value
                );
            },

            valueOf: function() {
                return this.value;
            },

            toString: function() {
                return String(this.value);
            }
        };
        VersionPart.cast = function(value) {
            var versionPart;
            if (typeof value === 'string' || typeof value === 'number') {
                versionPart = new VersionPart(value);
            } else if (value instanceof VersionPart) {
                versionPart = value;
            } else {
                throw new TypeError(
                    'VersionPart.cast expect a string, a number or a VersionPart instance' +
                    ' (got ' + value + ')'
                );
            }
            return versionPart;
        };

        function Version(firstArg) {
            this.update(firstArg);
        }
        Version.prototype = {
            constructor: Version,

            update: function(firstArg) {
                var versionName = String(firstArg);
                var major;
                var minor;
                var patch;

                if (versionName === anyChar) {
                    major = new VersionPart(anyChar);
                    minor = new VersionPart(anyChar);
                    patch = new VersionPart(anyChar);
                } else if (versionName === unspecifiedChar) {
                    major = new VersionPart(unspecifiedChar);
                    minor = new VersionPart(unspecifiedChar);
                    patch = new VersionPart(unspecifiedChar);
                } else if (versionName.indexOf('.') === -1) {
                    major = new VersionPart(versionName);
                    minor = new VersionPart(unspecifiedChar);
                    patch = new VersionPart(unspecifiedChar);
                } else {
                    var versionParts = versionName.split('.');
                    var versionPartCount = versionParts.length;

                    // truncate too precise version
                    if (versionPartCount > 3) {
                        versionParts = versionParts.slice(0, 3);
                        versionPartCount = 3;
                        this.truncated = true;
                    }

                    if (versionPartCount === 2) {
                        major = new VersionPart(versionParts[0]);
                        minor = new VersionPart(versionParts[1]);
                        patch = new VersionPart(unspecifiedChar);
                    } else if (versionPartCount === 3) {
                        major = new VersionPart(versionParts[0]);
                        minor = new VersionPart(versionParts[1]);
                        patch = new VersionPart(versionParts[2]);
                    }
                }

                this.major = major;
                this.minor = minor;
                this.patch = patch;
                this.raw = firstArg;
            },

            clone: function() {
                var clone = new Version(String(this));
                clone.raw = this.raw;
                return clone;
            },

            isAny: function() {
                return (
                    this.major.isAny() &&
                    this.minor.isAny() &&
                    this.patch.isAny()
                );
            },

            isSpecified: function() {
                return (
                    this.major.isSpecified() &&
                    this.minor.isSpecified() &&
                    this.patch.isSpecified()
                );
            },

            isUnspecified: function() {
                return (
                    this.major.isUnspecified() &&
                    this.minor.isUnspecified() &&
                    this.patch.isUnspecified()
                );
            },

            isPrecise: function() {
                return (
                    this.major.isPrecise() &&
                    this.minor.isPrecise() &&
                    this.patch.isPrecise()
                );
            },

            match: function(firstArg) {
                var version = Version.cast(firstArg);

                return (
                    this.major.match(version.major) &&
                    this.minor.match(version.minor) &&
                    this.patch.match(version.patch)
                );
            },

            above: function(firstArg, loose) {
                var version = Version.cast(firstArg);

                return (
                    this.major.above(version.major) ||
                    this.minor.above(version.minor) ||
                    this.patch.above(version.patch) ||
                    loose
                );
            },

            below: function(firstArg, loose) {
                var version = Version.cast(firstArg);

                return (
                    this.major.below(version.major) ||
                    this.minor.below(version.minor) ||
                    this.patch.below(version.patch) ||
                    loose
                );
            },

            toString: function() {
                if (this.isAny()) {
                    return anyChar;
                }
                if (this.isUnspecified()) {
                    return unspecifiedChar;
                }
                return this.major + '.' + this.minor + '.' + this.patch;
            }
        };
        Version.cast = function(value) {
            var version;
            if (typeof value === 'string' || typeof value === 'number') {
                version = new Version(value);
            } else if (value instanceof Version) {
                version = value;
            } else {
                throw new TypeError(
                    'Version.cast expect a string, a number or a Version instance' +
                    ' (got ' + value + ')'
                );
            }
            return version;
        };

        var acceptableVersionChars = [
            unspecifiedChar,
            anyChar,
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
        ];
        function couldBeVersionChar(char) {
            var i = acceptableVersionChars.length;
            while (i--) {
                if (char === String(acceptableVersionChars[i])) {
                    return true;
                }
            }
            return false;
        }

        var versionSeparator = '/';
        var VersionnableProperties = {
            setName: function(firstArg) {
                var lowerFirstArg = firstArg.toLowerCase();
                var separatorIndex = lowerFirstArg.indexOf(versionSeparator);
                if (separatorIndex === -1) {
                    this.name = lowerFirstArg;
                } else {
                    var beforeSeparator = lowerFirstArg.slice(0, separatorIndex).toLowerCase();
                    var afterSeparator = lowerFirstArg.slice(separatorIndex + versionSeparator.length);
                    // si c'est unknownChar, unspecifiedChar ou un nombre alors
                    // on a surement un nom qui est en fait nom + version
                    if (couldBeVersionChar(afterSeparator[0])) {
                        this.name = beforeSeparator;
                        this.setVersion(afterSeparator);
                    } else {
                        this.name = lowerFirstArg;
                    }
                }
            },
            setVersion: function(version) {
                this.version = jsenv.createVersion(version);
            },
            toString: function() {
                var shortNotation = '';

                shortNotation += this.name;
                if (this.version.isUnspecified()) {

                } else {
                    shortNotation += versionSeparator + this.version;
                }

                return shortNotation;
            },
            match: function(other) {
                if (typeof other === 'string') {
                    other = new this.constructor(other);
                }

                return (
                    this === other || (
                        this.name === other.name &&
                        this.version.match(other.version)
                    )
                );
            }
        };

        return {
            createVersion: function() {
                return jsenv.construct(Version, arguments);
            },

            createVersionPath: function() {
                return jsenv.construct(VersionPart, arguments);
            },

            makeVersionnable: function(Constructor) {
                jsenv.assign(Constructor.prototype, VersionnableProperties);
            },

            constructVersion: function(instance, args) {
                var arity = args.length;
                if (arity === 0) {
                    instance.setName('');
                    instance.setVersion('?');
                } else if (arity === 1) {
                    instance.setName(args[0]);
                    if (!instance.version) {
                        instance.setVersion('?');
                    }
                } else {
                    instance.setName(args[0]);
                    instance.setVersion(args[1]);
                }
            }
        };
    });
    provide(function platform() {
        // platform is what runs the agent : windows, linux, mac, ..

        function Platform() {
            jsenv.constructVersion(this, arguments);
        }
        Platform.prototype = {
            constructor: Platform
        };
        jsenv.makeVersionnable(Platform);
        var platform = new Platform('unknown');

        return {
            createPlatform: function() {
                return jsenv.construct(Platform, arguments);
            },
            platform: platform,

            isWindows: function() {
                return this.platform.name === 'windows';
            }
        };
    });
    provide(function agent() {
        // agent is what runs JavaScript : nodejs, iosjs, firefox, ...
        function Agent() {
            jsenv.constructVersion(this, arguments);
        }
        Agent.prototype = {
            constructor: Agent
        };
        jsenv.makeVersionnable(Agent);

        var agent = new Agent('unknown', '?');
        agent.type = 'unknown';

        return {
            createAgent: function() {
                return jsenv.construct(Agent, arguments);
            },

            agent: agent,

            isBrowser: function() {
                return this.agent.type === 'browser';
            },

            isNode: function() {
                return this.agent.type === 'node';
            }
        };
    });
    provide(function detectAgentAndPlatform() {
        var platformName;
        var platformVersion;
        var agentType;
        var agentName;
        var agentVersion;

        if (typeof window === 'object') {
            if (
                typeof window.WorkerGlobalScope === 'object' &&
                typeof navigator === 'object' &&
                typeof navigator instanceof window.WorkerNavigator
            ) {
                agentType = 'webworker';
                agentName = 'unknown';
                agentVersion = '?';
                platformName = 'unknown';
                platformVersion = '?';
            } else {
                agentType = 'browser';

                var ua = navigator.userAgent.toLowerCase();
                var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+(?:\.\d+)?)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
                var UA = ua.match(regex) || [null, 'unknown', 0];

                agentName = UA[1] === 'version' ? UA[3] : UA[1];
                if (UA[1] === 'ie' && document.documentMode) {
                    agentVersion = document.documentMode;
                } else if (UA[1] === 'opera' && UA[4]) {
                    agentVersion = UA[4];
                } else {
                    agentVersion = UA[2];
                }

                platformName = window.navigator.platform;
                if (platformName === 'Win32') {
                    platformName = 'windows';
                }
                platformVersion = '?';
            }
        } else if (typeof process === 'object' && {}.toString.call(process) === "[object process]") {
            agentType = 'node';
            agentName = 'node';
            agentVersion = process.version.slice(1);

            // https://nodejs.org/api/process.html#process_process_platform
            // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
            platformName = process.platform;
            if (platformName === 'win32') {
                platformName = 'windows';
            }
            platformVersion = require('os').release();
        } else {
            agentType = 'unknown';
            agentName = 'unknown';
            agentVersion = '?';
            platformName = 'unknown';
            platformVersion = '?';
        }

        var agent = jsenv.createAgent(agentName, agentVersion);
        agent.type = agentType;
        var platform = jsenv.createPlatform(platformName, platformVersion);

        return {
            agent: agent,
            platform: platform
        };
    });
    provide(function userAgent() {
        function createUserAgent() {
            var userAgent = '';
            userAgent += jsenv.agent.name;
            userAgent += '/';
            userAgent += jsenv.agent.version;
            userAgent += ' (';
            userAgent += jsenv.platform.name;
            userAgent += ' ';
            userAgent += jsenv.platform.version;
            userAgent += ')';
            return userAgent;
        }

        return {
            createUserAgent: createUserAgent,
            userAgent: createUserAgent()
        };
    });
    provide(function locationInformations() {
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
            baseURL: baseURL, // from where am I running jsenv
            internalURL: internalURL, // where is this file
            dirname: parentPath(internalURL), // dirname of this file
            cleanPath: cleanPath,
            parentPath: parentPath
        };
    });
    provide(function logger() {
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
    provide(function cancellableAssignment() {
        function CancellableAssignement(owner, name) {
            this.assigned = false;
            this.owner = owner;
            this.name = name;
            this.save();
        }
        CancellableAssignement.prototype = {
            constructor: CancellableAssignement,

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

        return {
            createCancellableAssignment: function(object, name) {
                var assignment = new CancellableAssignement(object, name);
                // assignment.save();
                return assignment;
            }
        };
    });
    provide(function provideGlobalValue() {
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
    provide(function globalAccessor() {
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

        var globalAssignment = this.createCancellableAssignment(this.global, this.globalName);
        globalAssignment.assign(this);

        return {
            globalAssignment: globalAssignment
        };
    });

    var Iterable = (function() {
        var Iterable = {};
        Iterable.forEach = function forEach(iterable, fn, bind) {
            var i = 0;
            var j = iterable.length;
            while (i < j) {
                fn.call(bind, iterable[i], i, iterable);
                i++;
            }
            return iterable;
        };
        Iterable.map = function map(iterable, fn, bind) {
            var mappedIterable = [];
            Iterable.forEach(iterable, function(entry, i) {
                mappedIterable[i] = fn.call(bind, entry, i, iterable);
            });
            return mappedIterable;
        };
        Iterable.filter = function filter(iterable, fn, bind) {
            var filteredIterable = [];
            Iterable.forEach(iterable, function(entry, index, iterable) {
                if (fn.call(bind, entry, index, iterable)) {
                    filteredIterable.push(entry);
                }
            });
            return filteredIterable;
        };
        Iterable.findIndex = function find(iterable, fn, bind) {
            var i = 0;
            var j = iterable.length;
            var foundIndex = -1;

            while (i < j) {
                var entry = iterable[i];
                if (fn.call(bind, entry, i, iterable)) {
                    foundIndex = i;
                    break;
                }
                i++;
            }

            return foundIndex;
        };
        Iterable.find = function find(iterable) {
            var foundIndex = Iterable.findIndex.apply(this, arguments);
            return foundIndex === -1 ? null : iterable[foundIndex];
        };
        Iterable.includes = function includes(iterable, item) {
            return iterable.indexOf(item) > -1;
        };
        Iterable.every = function every(iterable, fn, bind) {
            var everyEntryIsTruthy = true;
            var i = 0;
            var j = iterable.length;
            while (i < j) {
                if (Boolean(fn.call(bind, iterable[i], i, iterable)) === false) {
                    everyEntryIsTruthy = false;
                    break;
                }
                i++;
            }
            return everyEntryIsTruthy;
        };
        Iterable.some = function some(iterable, fn, bind) {
            var someEntryIsTruthy = false;
            var i = 0;
            var j = iterable.length;
            while (i < j) {
                if (fn.call(bind, iterable[i], i, iterable)) {
                    someEntryIsTruthy = true;
                    break;
                }
                i++;
            }
            return someEntryIsTruthy;
        };
        Iterable.bisect = function bisect(iterable, fn, bind) {
            var firstHalf = [];
            var secondHalf = [];

            Iterable.forEach(iterable, function(entry, index) {
                if (fn.call(bind, entry, index, iterable)) {
                    firstHalf.push(entry);
                } else {
                    secondHalf.push(entry);
                }
            });

            return [firstHalf, secondHalf];
        };
        Iterable.remove = function remove(iterable, item) {
            var index = iterable.indexOf(item);
            if (index > -1) {
                iterable.splice(index, 1);
                return true;
            }
            return false;
        };
        Iterable.uniq = function uniq(iterable) {
            function onlyUnique(value, index, self) {
                return self.indexOf(value) === index;
            }
            return Iterable.filter(iterable, onlyUnique);
        };
        Iterable.flatten = function flatten(iterable) {
            return [].concat.apply([], iterable);
        };
        return Iterable;
    })();
    provide('Iterable', Iterable);

    var Predicate = (function() {
        var Predicate = {};

        Predicate.not = function(predicate) {
            return function() {
                return !predicate.apply(this, arguments);
            };
        };
        Predicate.fails = function(fn, verifyThrowValue) {
            return function() {
                try {
                    fn.apply(this, arguments);
                    return false;
                } catch (e) {
                    if (verifyThrowValue) {
                        if (typeof verifyThrowValue === 'function') {
                            return verifyThrowValue(e);
                        }
                        if (typeof verifyThrowValue === 'object') {
                            if (verifyThrowValue === e) {
                                return true;
                            }
                            if (typeof e === 'object') {
                                return Iterable.every(Object.keys(verifyThrowValue), function(key) {
                                    return e[key] === verifyThrowValue[key];
                                });
                            }
                            return false;
                        }
                        return verifyThrowValue === e;
                    }
                    return true;
                }
            };
        };
        Predicate.some = function() {
            var predicates = arguments;
            var j = predicates.length;
            return function() {
                var someIsValid = false;
                var i = 0;
                while (i < j) {
                    var predicate = predicates[i];
                    if (predicate.apply(this, arguments)) {
                        someIsValid = true;
                        break;
                    }
                    i++;
                }
                return someIsValid;
            };
        };
        Predicate.every = function() {
            var predicates = arguments;
            var j = predicates.length;
            if (j === 0) {
                throw new Error('misisng arg to every');
            }
            return function() {
                var everyAreValid = true;
                var i = 0;
                while (i < j) {
                    var predicate = predicates[i];
                    if (!predicate.apply(this, arguments)) {
                        everyAreValid = false;
                        break;
                    }
                    i++;
                }
                return everyAreValid;
            };
        };

        return Predicate;
    })();
    provide('Predicate', Predicate);

    // we need a promise like object to use Promise power even in environment wo Promise
    // we reuse this one https://github.com/taylorhakes/promise-polyfill/blob/master/promise.js
    var Thenable = (function() {
        var forOf = (function() {
            if (typeof Symbol === 'function' && 'iterator' in Symbol) {
                return function forOf(iterable, fn, bind) {
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
                };
            }
            return function forOf(iterable, fn, bind) {
                for (var key in iterable) {
                    if (iterable.hasOwnProperty(key)) {
                        fn.call(bind, iterable[key]);
                    }
                }
            };
        })();
        var triggerUnhandled = (function() {
            if (jsenv.isBrowser()) {
                return function tiggerUnhandled(value, promise) {
                    if (window.onunhandledrejection) {
                        window.onunhandledrejection(value, promise);
                    } else {
                        // var mess = value instanceof Error ? value.stack : value;
                        console.log('possibly unhandled rejection "' + value + '" for promise', promise);
                    }
                };
            }
            return function tiggerUnhandled(value, promise) {
                if (process.listeners('unhandledRejection').length === 0) {
                    var mess = value instanceof Error ? value.stack : value;
                    console.log('possibly unhandled rejection "' + mess + '" for promise', promise);
                }
                process.emit('unhandledRejection', value, promise);
            };
        })();
        var triggerHandled = (function() {
            if (jsenv.isBrowser()) {
                return function triggerHandled(promise) {
                    if (window.onrejectionhandled) {
                        window.onrejectionhandled(promise);
                    }
                };
            }
            return function triggerHandled(promise) {
                process.emit('rejectionHandled', promise);
            };
        })();
        var asap = (function() {
            if (typeof setImmediate === 'function') {
                return setImmediate;
            }
            return setTimeout;
        })();
        function callThenable(thenable, onFulfill, onReject) {
            var then;
            try {
                then = thenable.then;
                then.call(thenable, onFulfill, onReject);
            } catch (e) {
                onReject(e);
            }
        }
        function isThenable(object) {
            if (object) {
                return typeof object.then === 'function';
            }
            return false;
        }
        function bindAndOnce(fn, thisValue) {
            var called = false;
            return function boundAndCalledOnce() {
                if (called === false) {
                    called = true;
                    return fn.apply(thisValue, arguments);
                }
            };
        }
        function noop() {}

        function Thenable(executor) {
            if (arguments.length === 0) {
                throw new Error('missing executor function');
            }
            if (typeof executor !== 'function') {
                throw new TypeError('function expected as executor');
            }

            this.status = 'pending';

            if (executor !== noop) {
                try {
                    executor(
                        bindAndOnce(resolveThenable, this),
                        bindAndOnce(rejectThenable, this)
                    );
                } catch (e) {
                    rejectThenable.call(this, e);
                }
            }
        }
        Thenable.prototype = {
            constructor: Thenable,
            unhandledTriggered: false,
            handled: false,
            toString: function() {
                return '[object Thenable]';
            },
            then: function(onFulfill, onReject) {
                if (onFulfill && typeof onFulfill !== 'function') {
                    throw new TypeError('then first arg must be a function ' + onFulfill + ' given');
                }
                if (onReject && typeof onReject !== 'function') {
                    throw new TypeError('then second arg must be a function ' + onReject + ' given');
                }

                var thenable = new this.constructor(noop);
                var handler = {
                    thenable: thenable,
                    onFulfill: onFulfill || null,
                    onReject: onReject || null
                };
                handle(this, handler);
                return thenable;
            },
            'catch': function(onReject) {
                return this.then(null, onReject);
            }
        };
        function resolveThenable(value) {
            try {
                if (isThenable(value)) {
                    if (value === this) {
                        throw new TypeError('A promise cannot be resolved with itself');
                    } else {
                        this.status = 'resolved';
                        this.value = value;
                        callThenable(
                            value,
                            bindAndOnce(resolveThenable, this),
                            bindAndOnce(rejectThenable, this)
                        );
                    }
                } else {
                    this.status = 'fulfilled';
                    this.value = value;
                    settleThenable(this);
                }
            } catch (e) {
                rejectThenable.call(this, e);
            }
        }
        function rejectThenable(value) {
            this.status = 'rejected';
            this.value = value;
            settleThenable(this);
        }
        function settleThenable(thenable) {
            if (thenable.status === 'rejected' && thenable.handled === false) {
                asap(function() {
                    if (!thenable.handled) {
                        triggerUnhandled(thenable.value, thenable);
                        thenable.unhandledTriggered = true;
                    }
                });
            }

            var hasPendingList = thenable.hasOwnProperty('pendingList');
            if (hasPendingList) {
                var pendingList = thenable.pendingList;
                var i = 0;
                var j = pendingList.length;
                while (i < j) {
                    handle(thenable, pendingList[i]);
                    i++;
                }
                // on peut "supprimer" pendingList mais
                pendingList.length = 0;
            }
        }
        function handle(thenable, handler) {
            // on doit s'inscrire sur la bonne pendingList
            // on finis forcément par tomber sur un thenable en mode 'pending'
            while (thenable.status === 'resolved') {
                thenable = thenable.value;
            }
            if (thenable.unhandledTriggered) {
                triggerHandled(thenable);
            }
            thenable.handled = true;

            if (thenable.status === 'pending') {
                if (thenable.hasOwnProperty('pendingList')) {
                    thenable.pendingList.push(handler);
                } else {
                    thenable.pendingList = [handler];
                }
            } else {
                asap(function() {
                    var isFulfilled = thenable.status === 'fulfilled';
                    var value = thenable.value;
                    var callback = isFulfilled ? handler.onFulfill : handler.onReject;

                    if (callback !== null) {
                        try {
                            value = callback(value);
                        } catch (e) {
                            isFulfilled = false;
                            value = e;
                        }
                    }

                    var sourceThenable = handler.thenable;
                    if (isFulfilled) {
                        resolveThenable.call(sourceThenable, value);
                    } else {
                        rejectThenable.call(sourceThenable, value);
                    }
                });
            }
        }

        Thenable.resolve = function resolve(value) {
            if (arguments.length > 0) {
                if (value instanceof this && value.constructor === this) {
                    return value;
                }
            }

            return new this(function resolveExecutor(resolve) {
                resolve(value);
            });
        };
        Thenable.reject = function reject(value) {
            return new this(function rejectExecutor(resolve, reject) {
                reject(value);
            });
        };
        Thenable.all = function all(iterable) {
            return new this(function allExecutor(resolve, reject) {
                var index = 0;
                var length = 0;
                var values = [];
                var resolveOne = function(value, index) {
                    if (isThenable(value)) {
                        callThenable(value, function(value) {
                            resolveOne(value, index);
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
                    resolveOne(value, index);
                    index++;
                });

                if (length === 0) {
                    resolve(values);
                }
            });
        };
        Thenable.race = function race(iterable) {
            return new this(function(resolve, reject) {
                forOf(iterable, function(thenable) {
                    thenable.then(resolve, reject);
                });
            });
        };

        return Thenable;
    })();
    provide('Thenable', Thenable);
})();

/*
Cette seconde partie concerne les features et l'implementation de celle-ci
On s'en sert pour tester comment se comporte l'environnement et pouvoir réagir
en fonction du résultat de ces tests
*/
(function() {
    var Iterable = jsenv.Iterable;
    // var Predicate = jsenv.Predicate;
    var Thenable = jsenv.Thenable;

    /*
    plus tard on pourrais imaginer supporter les features avec des version par exemple
    array/1.0.0/from/0.1.0 signifie array version 1.0.0, from version 0.1.0
    il faudra alors changer le code qui parcoure le filesystem pour qu'il détecte
    le dossiers commençant par [0-9] et considère que c'est une version de la feature
    c'est bien entendu de l'ultra bonus et pas besoin de ça pour le moment
    */

    jsenv.provide(function versionnedFeature() {
        function VersionnedFeature() {
            this.dependents = [];
            this.dependencies = [];
            this.parameters = [];
            jsenv.constructVersion(this, arguments);
        }
        VersionnedFeature.prototype = {
            constructor: VersionnedFeature,
            enabled: false,

            getPath: function() {
                var path = [];
                var selfOrParent = this;
                while (selfOrParent && selfOrParent.path) {
                    path.unshift(selfOrParent.path);
                    selfOrParent = selfOrParent.parent;
                }
                return path.join('.');
            },

            createRegisterCode: function(source) {
                var featureNameSource = "'" + this.name + "'";
                var featurePropertiesSource = '';
                if (source) {
                    featurePropertiesSource += 'function(feature, parent, expose) {\n\t';
                    featurePropertiesSource += source;
                    featurePropertiesSource += '\n}';
                } else {
                    featurePropertiesSource = 'null';
                }

                return 'registerFeature(' + featureNameSource + ', ' + featurePropertiesSource + ');';
            },

            addDependent: function(dependentFeature, options) {
                dependentFeature.addDependency(this, options);
                return this;
            },

            addDependency: function(dependency, options) {
                if (dependency instanceof VersionnedFeature === false) {
                    throw new Error('addDependency first arg must be a feature (not ' + dependency + ')');
                }
                if (Iterable.includes(this.dependencies, dependency)) {
                    if (options.preventDuplicateError) {
                        return this;
                    }
                    throw new Error(this.name + ' already dependent of ' + dependency.name);
                }
                if (this.isDependentOf(dependency)) {
                    throw new Error('cyclic dependency between ' + dependency.name + ' and ' + this.name);
                }

                var asParameter = options && options.as === 'parameter';
                var asParent = options && options.as === 'parent';

                if (asParameter) {
                    this.parameters.push(dependency);
                } else if (dependency.isDisabled()) {
                    this.disable();
                }

                if (asParent) {
                    this.parent = dependency;
                    this.dependencies.unshift(dependency);
                } else {
                    this.dependencies.push(dependency);
                }
                dependency.dependents.push(this);
            },

            isDependentOf: function(feature) {
                var dependents = this.dependents;
                var i = dependents.length;
                while (i--) {
                    var dependent = dependents[i];
                    if (dependent.match(feature)) {
                        return true;
                    }
                    if (dependent.isDependentOf(feature)) {
                        return true;
                    }
                }
                return false;
            },

            dependsOn: function() {
                Iterable.forEach(arguments, function(arg) {
                    this.addDependency(arg);
                }, this);
            },

            influencedBy: function() {
                Iterable.forEach(arguments, function(arg) {
                    this.addDependency(arg, {as: 'parameter'});
                }, this);
            },
            // isParameterizedBy: function(feature) {
            //     return Iterable.includes(this.parameters, feature);
            // },
            isParameterOf: function(feature) {
                return Iterable.includes(this.parameters, feature);
            },

            disable: function(reason) {
                if (this.isEnabled()) {
                    this.enabled = false;
                    this.disableReason = reason;
                    Iterable.forEach(this.dependents, function(dependent) {
                        if (this.isParameterOf(dependent) === false) {
                            dependent.disable('dependent-is-disabled');
                        }
                    }, this);
                }
                return this;
            },
            enable: function(reason) {
                if (this.isDisabled()) {
                    this.enabled = true;
                    this.enableReason = reason;
                    Iterable.forEach(this.dependencies, function(dependency) {
                        if (dependency.isParameterOf(this) === false) {
                            dependency.enable('dependency-is-enabled');
                        }
                    }, this);
                }
                return this;
            },
            isEnabled: function() {
                return this.enabled === true;
            },
            isDisabled: function() {
                return this.enabled !== true;
            },

            beforeTest: function() {},

            test: function(callback) {
                var feature = this;
                var settled = false;
                var result = {};
                var timeout;
                var settle = function(valid, reason, detail) {
                    if (settled === false) {
                        settled = true;
                        if (timeout) {
                            clearTimeout(timeout);
                            timeout = null;
                        }
                        var arity = arguments.length;

                        if (arity === 0) {
                            result.status = 'unspecified';
                        } else {
                            result.status = valid ? 'valid' : 'invalid';
                            result.reason = reason;
                            result.detail = detail;
                        }

                        callback.call(feature, result, feature);
                    }
                };

                var beforeTestError;
                try {
                    this.beforeTest();
                } catch (e) {
                    beforeTestError = e;
                }

                if (beforeTestError) {
                    settle(false, 'before-test-throw', beforeTestError);
                } else {
                    var output;
                    var outputOrigin;
                    try {
                        output = this.compile();
                        outputOrigin = 'return';
                    } catch (e) {
                        output = e;
                        outputOrigin = 'throw';
                    }

                    var settler;
                    var settlerPropertyName = outputOrigin === 'throw' ? 'fail' : 'pass';
                    if (this.hasOwnProperty(settlerPropertyName)) {
                        settler = this[settlerPropertyName];
                        var type = typeof settler;
                        if (type !== 'function') {
                            throw new TypeError(
                                'feature.' + settlerPropertyName +
                                ' must be a function (not ' + type + ')'
                            );
                        }
                        // ce throw au dessus fait que settle n'est jamais appelé
                        // et bizarrement l'erreur n'est jamais log...

                        var settlerArgs = [];
                        settlerArgs.push(output);
                        Iterable.forEach(this.parameters, function(parameter) {
                            settlerArgs.push(parameter);
                        });
                        settlerArgs.push(settle);
                        settler = convertToSettler(settler);

                        try {
                            settler.apply(
                                this,
                                settlerArgs
                            );

                            var maxDuration = feature.maxTestDuration;
                            timeout = setTimeout(function() {
                                settle(false, 'timeout', maxDuration);
                            }, maxDuration);
                        } catch (e) {
                            settle(false, 'throwed', e);
                        }
                    } else {
                        settle(false, 'unexpected-compilation-' + outputOrigin);
                    }
                }

                return this;
            },
            run: undefined,
            pass: function() {
                return true;
            },
            solution: {
                type: 'none',
                value: undefined
            },
            maxTestDuration: 100,
            compile: function() {
                var output;

                if (this.hasOwnProperty('run')) {
                    var run = this.run;

                    if (jsenv.isSourceCode(run)) {
                        output = run.compile();
                    } else if (typeof run === 'function') {
                        output = run.call(this);
                    } else {
                        output = run;
                    }
                } else {
                    output = undefined;
                }

                return output;
            },

            toJSON: function() {
                return {
                    name: this.name,
                    run: this.run,
                    pass: this.pass,
                    fail: this.fail,
                    solution: this.solution,
                    maxTestDuration: this.maxTestDuration
                };
            }
        };
        jsenv.makeVersionnable(VersionnedFeature);

        function convertToSettler(fn) {
            return function() {
                var args = arguments;
                var arity = args.length;
                var fnArity = fn.length;

                if (fnArity < arity) {
                    var settle = args[arity - 1];
                    var returnValue = fn.apply(this, args);
                    settle(Boolean(returnValue), 'returned', returnValue);
                } else {
                    fn.apply(this, args);
                }
            };
        }

        // feature testing helpers
        var helpers = (function() {
            function DeepValue() {

            }
            DeepValue.prototype = {
                constructor: DeepValue,
                reached: false,
                read: function(property) {
                    var next;
                    if (this.reached) {
                        if (property in this.value) {
                            next = new DeepValue();
                            next.reached = true;
                            next.value = this.value[property];
                            next.property = property;
                        } else {
                            next = new DeepValue();
                            next.reached = false;
                            next.property = property;
                        }
                    } else {
                        next = new DeepValue();
                        next.reached = false;
                        next.property = property;
                    }
                    next.previous = this;
                    return next;
                },
                polyfill: function(value) {
                    var previous = this.previous;
                    if (!previous) {
                        throw new Error('polyfill expect previous');
                    }
                    if (!previous.reached) {
                        throw new Error('polyfill expect previous to be reachable');
                    }
                    if (this.reached) {
                        // il est possible qu'on force le polyfill pour deux raisons :
                        // (a) la version actuelle ne se comporte pas correctement d'après nos tests
                        // (b) un met le polyfill par mesure de sécurité car on ne sait
                        //     pas comment se comporte la version actuelle (pas testé)
                    }
                    // console.log('polyfill', this, 'at', this.property, 'with', value);
                    previous.value[this.property] = value;
                }
            };

            function createDeepValue() {
                var deepValue = new DeepValue();
                return deepValue;
            }

            function isDeepValue(a) {
                return a instanceof DeepValue;
            }

            return {
                runStandard: runStandard,
                standardPresence: standardPresence,
                createIterableObject: createIterableObject,
                collectKeys: collectKeys,
                sameValues: sameValues,
                polyfill: polyfill
            };

            function runStandard() {
                var i = 0;
                var j = arguments.length;
                var args = [];
                var composedValue = createDeepValue();
                while (i < j) {
                    var arg = arguments[i];
                    if (jsenv.isFeature(arg)) {
                        args.push(arg);
                    } else if (typeof arg === 'string') {
                        if (i === 0) {
                            composedValue.value = jsenv.global;
                            composedValue.reached = true;
                        }
                        args.push({
                            property: arg,
                            compile: function(previousOutput) {
                                var deepValue;
                                if (isDeepValue(previousOutput)) {
                                    deepValue = previousOutput;
                                } else {
                                    deepValue = createDeepValue();
                                    deepValue.value = previousOutput;
                                    deepValue.reached = true;
                                }
                                return deepValue.read(this.property);
                            }
                        });
                    }
                    i++;
                }

                return function() {
                    var previousOutput = arguments.length === 0 ? composedValue : arguments[0];
                    var composedOutput = previousOutput;
                    var i = 0;

                    while (i < j) {
                        var arg = args[i];
                        var output;
                        output = arg.compile(previousOutput);
                        composedOutput = output;
                        previousOutput = output;
                        i++;
                    }

                    return composedOutput;
                };
            }
            function standardPresence(output, settle) {
                if (isDeepValue(output)) {
                    if (output.reached) {
                        settle(true, 'present');
                    } else {
                        settle(false, 'missing');
                    }
                } else {
                    settle(false, 'output-must-be-deep-value', output);
                }
            }
            function createIterableObject(arr, methods) {
                var j = arr.length;
                var iterable = {};
                iterable[Symbol.iterator] = function() {
                    var i = -1;
                    var iterator = {
                        next: function() {
                            i++;
                            return {
                                value: i === j ? undefined : arr[i],
                                done: i === j
                            };
                        }
                    };
                    jsenv.assign(iterator, methods || {});
                    iterator.iterable = iterable;

                    return iterator;
                };
                return iterable;
            }
            function collectKeys(value) {
                var keys = [];
                for (var key in value) {
                    if (value.hasOwnProperty(key)) {
                        if (isNaN(key) === false && value instanceof Array) {
                            // key = Number(key);
                            keys.push(key);
                        } else {
                            keys.push(key);
                        }
                    }
                }
                return keys;
            }
            function sameValues(a, b) {
                if (typeof a === 'string') {
                    a = convertStringToArray(a);
                } else if (typeof a === 'object' && typeof a.next === 'function') {
                    a = consumeIterator(a);
                }
                if (typeof b === 'string') {
                    b = convertStringToArray(b);
                } else if (typeof b === 'object' && typeof b.next === 'function') {
                    b = consumeIterator(b);
                }

                if (a.length !== b.length) {
                    return false;
                }
                var i = a.length;
                while (i--) {
                    if (a[i] !== b[i]) {
                        return false;
                    }
                }
                return true;
            }
            function convertStringToArray(string) {
                var result = [];
                var i = 0;
                var j = string.length;
                while (i < j) {
                    var char = string[i];

                    if (i < j - 1) {
                        var charCode = string.charCodeAt(i);

                        // fix astral plain strings
                        if (charCode >= 55296 && charCode <= 56319) {
                            i++;
                            result.push(char + string[i]);
                        } else {
                            result.push(char);
                        }
                    } else {
                        result.push(char);
                    }
                    i++;
                }
                return result;
            }
            function consumeIterator(iterator) {
                var values = [];
                var next = iterator.next();
                while (next.done === false) {
                    values.push(next.value);
                    next = iterator.next();
                }
                return values;
            }
            function polyfill(value) {
                var i = 0;
                var j = arguments.length;

                if (j === 0) {

                } else {
                    var output = this.compile();
                    if (isDeepValue(output)) {
                        var lastArg;
                        if (j === 1) {
                            lastArg = arguments[i];
                        } else {
                            var lastIndex = j - 1;
                            while (i < lastIndex) {
                                // on fait rien de spéc av les arg pour le moment
                                i++;
                            }
                            lastArg = arguments[lastIndex];
                        }
                        if (typeof lastArg === 'function') {
                            value = lastArg.apply(this, this.dependencies);
                        } else {
                            value = lastArg;
                        }
                        output.polyfill(value);
                    } else {
                        throw new TypeError(
                            'feature.polyfill must be called on a feature compiled to deepValue'
                        );
                    }
                }
            }
        })();
        jsenv.assign(VersionnedFeature.prototype, helpers);

        return {
            createFeature: function() {
                var arity = arguments.length;
                if (arity === 0) {
                    return new VersionnedFeature();
                }
                if (arity === 1) {
                    return new VersionnedFeature(arguments[0]);
                }
                return new VersionnedFeature(arguments[0], arguments[1]);
            },

            isFeature: function(value) {
                return value instanceof VersionnedFeature;
            }
        };
    });

    jsenv.provide(function sourceCode() {
        var SourceCode = function(source) {
            // https://github.com/dmnd/dedent/blob/master/dedent.js
            var lines = source.split('\n');
            var lowestIndent = null;
            Iterable.forEach(lines, function(line) {
                var match = line.match(/^(\s+)\S+/);
                if (match) {
                    var indent = match[1].length;
                    if (lowestIndent) {
                        lowestIndent = Math.min(lowestIndent, indent);
                    } else {
                        lowestIndent = indent;
                    }
                }
            });
            if (typeof lowestIndent === 'number') {
                source = Iterable.map(lines, function(line) {
                    var firstChar = line[0];
                    if (firstChar === ' ' || firstChar === '\t') {
                        return line.slice(lowestIndent);
                    }
                    return line;
                }).join('\n');
            }

            // eats leading and trailing whitespace too (trim)
            source = source.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
            // handle escaped newlines at the end to ensure they don't get stripped too
            source = source.replace(/\\n/g, "\n");

            this.source = source;
        };
        SourceCode.prototype = {
            constructor: SourceCode,
            compile: function() {
                return eval(this.source); // eslint-disable-line no-eval
            }
        };

        return {
            createSourceCode: function() {
                return jsenv.construct(SourceCode, arguments);
            },

            isSourceCode: function(value) {
                return value instanceof SourceCode;
            },

            transpile: function transpile(strings) {
                var result;
                var raw = strings.raw;
                var i = 0;
                var j = raw.length;
                result = raw[i];
                i++;
                while (i < j) {
                    result += arguments[i];
                    result += raw[i];
                    i++;
                }
                return jsenv.createSourceCode(result);
            }
        };
    });

    jsenv.provide(function registerFeatures() {
        var Iterable = jsenv.Iterable;

        function registerFeatures(fn) {
            var concreteVersions = [];
            var abstractVersions = [];
            fn(registerFeature, jsenv.transpile);

            function concrete(featureName) {
                var feature;
                var concreteVersion = findConcrete(featureName);
                if (concreteVersion) {
                    throw new Error('feature ' + featureName + ' already exists');
                }

                var abstractVersion = findAbstract(featureName);
                if (abstractVersion) {
                    feature = abstractVersion.feature;
                    Iterable.remove(abstractVersions, abstractVersion);
                } else {
                    feature = jsenv.createFeature(featureName);
                }
                concreteVersion = {
                    feature: feature
                };
                concreteVersions.push(concreteVersion);
                return feature;
            }
            function findConcrete(featureName) {
                return Iterable.find(concreteVersions, function(concreteVersion) {
                    return concreteVersion.feature.match(featureName);
                });
            }
            function findAbstract(featureName) {
                return Iterable.find(abstractVersions, function(abstractVersion) {
                    return abstractVersion.feature.match(featureName);
                });
            }
            function abstract(featureName, dependent) {
                var feature;

                var concreteVersion = findConcrete(featureName);
                if (concreteVersion) {
                    feature = concreteVersion.feature;
                } else {
                    var abstractVersion = findAbstract(featureName);

                    if (abstractVersion) {
                        feature = abstractVersion.feature;
                        abstractVersion.dependents.push(dependent);
                    } else {
                        feature = jsenv.createFeature(featureName);
                        abstractVersion = {
                            feature: feature,
                            dependents: [dependent]
                        };
                        abstractVersions.push(abstractVersion);
                    }
                }
                return feature;
            }

            function registerFeature(name, propertiesConstructor) {
                var feature = concrete(name);
                var properties = {};
                var lastSlashIndex = name.lastIndexOf('/');
                var parent;

                if (lastSlashIndex > -1) {
                    var parentName = name.slice(0, lastSlashIndex);
                    parent = abstract(parentName, feature);
                    feature.addDependency(parent, {as: 'parent'});
                }

                if (propertiesConstructor) {
                    // sort of module.exports
                    feature.expose = function() {
                        var dependencies = [];
                        var pojo;
                        var i = 0;
                        var j = arguments.length;
                        if (j === 0) {
                            pojo = {};
                        } else {
                            var lastArg;
                            if (j === 1) {
                                lastArg = arguments[i];
                            } else {
                                var lastIndex = j - 1;
                                while (i < lastIndex) {
                                    var arg = arguments[i];
                                    if (typeof arg === 'string') {
                                        var dependency = abstract(arg, feature);
                                        feature.addDependency(dependency);
                                        dependencies.push(dependency);
                                    } else {
                                        throw new TypeError('expose() dependency arg must be string');
                                    }
                                    i++;
                                }
                                lastArg = arguments[lastIndex];
                            }
                            if (typeof lastArg === 'function') {
                                pojo = lastArg.apply(feature, dependencies);
                            } else if (typeof lastArg === 'object') {
                                pojo = lastArg;
                            }
                        }

                        jsenv.assign(properties, pojo);
                    };

                    propertiesConstructor.call(properties,
                        feature,
                        feature.parent,
                        feature.expose
                    );
                } else {
                    // un dossier vide a un code et un pass qui réussi par défaut
                    properties.run = function() {};
                    properties.pass = function() {
                        return true;
                    };
                }

                checkProperty(feature, properties, 'run', parent);
                checkProperty(feature, properties, 'pass');
                checkProperty(feature, properties, 'fail');
                checkProperty(feature, properties, 'maxTestDuration');
                checkProperty(feature, properties, 'solution', parent);

                return feature;
            }
            function checkProperty(feature, properties, propertyName, parent) {
                if (propertyName in properties) {
                    assignProperty(feature, properties[propertyName], propertyName);
                } else if (parent) {
                    assignProperty(feature, parent[propertyName], propertyName);
                }
            }
            function assignProperty(feature, propertyValue, propertyName) {
                if (propertyName === 'solution' && propertyValue === 'none') {
                    propertyValue = {
                        type: 'none',
                        value: undefined
                    };
                }
                feature[propertyName] = propertyValue;
            }

            var concreteFeatures = concreteVersions.map(function(concreteVersion) {
                return concreteVersion.feature;
            });

            if (abstractVersions.length) {
                // to get a simple error message we'll just throw with
                // one abstractVersion which was expected to become concrete
                var abstractVersion = abstractVersions[0];
                var abstractFeature = abstractVersion.feature;
                var dependentNames = abstractVersion.dependents.map(function(dependent) {
                    return dependent.name;
                });
                // console.log('the concrete feature names', concreteFeatures.map(function(feature) {
                //     return feature.name;
                // }));
                throw new Error(
                    abstractFeature.name + ' is required by ' + dependentNames + ' but is not registered'
                );
            }

            return concreteFeatures;
        }

        return {
            registerFeatures: registerFeatures
        };
    });

    jsenv.provide(function reviveFeatureEntries() {
        return {
            reviveFeatureEntries: function(entries) {
                var registerFeaturesHead = 'jsenv.registerFeatures(function(registerFeature, transpile) {';
                var registerFeaturesBody = entries.map(function(entry) {
                    return entry.source;
                });
                var registerFeaturesFoot = '});';
                var registerFeaturesSource;
                registerFeaturesSource = (
                    '\n' +
                    registerFeaturesHead +
                    '\n\t' +
                    registerFeaturesBody.join('\n\t\n\t') +
                    '\n' +
                    registerFeaturesFoot +
                    '\n'
                );
                // require('fs').writeFileSync('./feature-output.js', registerFeaturesSource);

                var features = eval(registerFeaturesSource); // eslint-disable-line no-eval

                features.forEach(function(feature) {
                    var entry = Iterable.find(entries, function(entry) {
                        return feature.match(entry.feature.name);
                    });
                    entry.feature = feature;
                    if (entry.enabled) {
                        feature.enable();
                    }
                });
                return entries;
            }
        };
    });

    jsenv.provide(function testFeatures() {
        var Iterable = jsenv.Iterable;

        function testFeatures(features, progressCallback) {
            var results = [];
            var readyCount = 0;
            var groups = groupNodesByDependencyDepth(features);
            var group;
            var groupIndex = -1;
            var groupCount = groups.length;
            var groupReadyCount = 0;
            var done;
            var thenable = new Thenable(function(resolve) {
                done = function() {
                    resolve(results);
                };
            });

            function handleResult(result) {
                var feature = this; // callback is async, this is the right feature object we want
                var featureIndex = features.indexOf(feature);
                results[featureIndex] = result;
                readyCount++;

                if (progressCallback) {
                    var progressEvent = {
                        type: 'progress',
                        target: feature,
                        detail: result,
                        lengthComputable: true,
                        total: features.length,
                        loaded: readyCount
                    };
                    progressCallback(progressEvent);
                }
                groupReadyCount++;
                if (groupReadyCount === group.length) {
                    nextGroup();
                }
            }
            function isInvalid(feature) {
                var featureIndex = features.indexOf(feature);
                if (featureIndex in results === false) {
                    return false;
                }
                var result = results[featureIndex];
                return result.status === 'invalid';
            }
            function dependencyIsInvalid(dependency) {
                return (
                    dependency.isParameterOf(this) === false &&
                    isInvalid(dependency)
                );
            }
            function nextGroup() {
                groupIndex++;
                if (groupIndex === groupCount) {
                    // il faut faire setTimeout sur done
                    // je ne sais pas trop pourquoi sinon nodejs cache les erreurs qui pourraient
                    // être throw par done ou le callback
                    setTimeout(done);
                } else {
                    group = groups[groupIndex];
                    var i = 0;
                    var j = group.length;
                    groupReadyCount = 0;

                    while (i < j) {
                        var feature = group[i];
                        var dependencies = feature.dependencies;
                        var invalidDependency = Iterable.find(dependencies, dependencyIsInvalid, feature);
                        if (invalidDependency) {
                            handleResult.call(feature, {
                                status: 'invalid',
                                reason: 'dependency-is-invalid',
                                detail: invalidDependency.name
                            });
                        } else {
                            try {
                                feature.test(handleResult);
                            } catch (e) {
                                handleResult.call(feature, {
                                    status: 'invalid',
                                    reason: 'throw',
                                    detail: e
                                });
                            }
                        }
                        i++;
                    }
                }
            }
            nextGroup();
            return thenable;
        }

        function groupNodesByDependencyDepth(nodes) {
            var unresolvedNodes = nodes.slice();
            var i = 0;
            var j = unresolvedNodes.length;
            var resolvedNodes = [];
            var groups = [];
            var group;
            var isResolved = function(node) {
                // un noeud est résolu s'il fait parties des resolvedNodes
                // mais aussi s'il ne fait pas partie des noeud qu'on veut grouper
                return (
                    Iterable.includes(resolvedNodes, node) ||
                    Iterable.includes(nodes, node) === false
                );
            };

            while (true) { // eslint-disable-line
                group = [];
                i = 0;
                while (i < j) {
                    var unresolvedNode = unresolvedNodes[i];
                    var everyDependencyIsResolved = Iterable.every(unresolvedNode.dependencies, isResolved);
                    if (everyDependencyIsResolved) {
                        group.push(unresolvedNode);
                        unresolvedNodes.splice(i, 1);
                        j--;
                    } else {
                        i++;
                    }
                }

                if (group.length) {
                    groups.push(group);
                    resolvedNodes.push.apply(resolvedNodes, group);
                } else {
                    break;
                }
            }

            return groups;
        }

        return {
            testFeatures: testFeatures
        };
    });

    jsenv.provide(function createImplementationClient() {
        function createImplementationClient(mediator) {
            function testImplementation() {
                return mediator.send('getAllRequiredTest').then(function(data) {
                    var entries = data.entries;
                    var entriesToTest = entries.filter(entryHasTestMark);
                    var featuresToTest = entriesToTest.map(function(entry) {
                        return entry.feature;
                    });
                    var testRecords = createRecords();

                    return testFeatures(
                        featuresToTest,
                        testRecords
                    ).then(function() {
                        return mediator.send('setAllTestRecord', testRecords);
                    });
                });
            }
            function createRecords() {
                var records = [];
                return records;
            }
            function testFeatures(features, records) {
                return jsenv.testFeatures(features, function(event) {
                    console.log('tested', event.target.name, '->', event.detail);
                    records.push({
                        featureName: event.target.name,
                        output: {
                            status: 'completed',
                            reason: 'test-result',
                            detail: event.detail
                        }
                    });
                });
            }
            function fixImplementation() {
                return mediator.send('getAllRequiredFix').then(function(data) {
                    var entries = data.entries;
                    var fixRecords = createRecords();
                    var coreJSBuildSource = data.coreJSBuildSource;
                    var entriesToFix = entries.filter(entryHasTestMark);
                    var entriesUsingInlineSolution = entriesToFix.filter(entryUseInlineSolution);
                    var entriesUsingFileSolution = entriesToFix.filter(entryUseFileSolution);
                    var entriesUsingCoreJSSolution = entriesToFix.filter(entryUseCoreJSSolution);

                    function createConcatenedSolver(source) {
                        var output = {status: 'pending'};

                        return function() {
                            if (output.status === 'pending') {
                                try {
                                    var value = eval(source); // eslint-disable-line no-eval

                                    output.status = 'completed';
                                    output.reason = 'fixed';
                                    output.detail = value;
                                } catch (e) {
                                    output.status = 'crashed';
                                    output.reason = 'some-source';
                                    output.detail = e;
                                }
                            }

                            if (output.status === 'completed') {
                                return output.detail;
                            }
                            if (output.status === 'crashed') {
                                throw output.detail;
                            }
                        };
                    }
                    var coreJSSolver = createConcatenedSolver(coreJSBuildSource);
                    entriesUsingCoreJSSolution.forEach(function(entry) {
                        entry.feature.beforeTest = coreJSSolver;
                    });
                    entriesUsingInlineSolution.forEach(function(entry) {
                        entry.feature.beforeTest = function() {
                            this.polyfill(function() {
                                return this.solution.value;
                            });
                        };
                    });
                    entriesUsingFileSolution.forEach(function(entry) {
                        entry.feature.beforeTest = function() {
                            entry.feature.solver(this);
                        };
                    });

                    var featuresToTest = entriesToFix.map(function(entry) {
                        return entry.feature;
                    });
                    return testFeatures(featuresToTest, fixRecords).then(function() {
                        return mediator.send('setAllFixRecord', fixRecords);
                    });
                });
            }
            function entryUseInlineSolution(entry) {
                return entry.feature.solution.type === 'inline';
            }
            function entryUseFileSolution(entry) {
                return entry.feature.solution.type === 'file';
            }
            function entryUseCoreJSSolution(entry) {
                return entry.feature.solution.type === 'corejs';
            }
            function scanImplementation() {
                return testImplementation().then(function() {
                    return fixImplementation();
                });
            }
            function entryHasTestMark(entry) {
                return entry.mustBeTested;
            }

            return {
                test: testImplementation,
                fix: fixImplementation,
                scan: scanImplementation
            };
        }

        return {
            createImplementationClient: createImplementationClient
        };
    });
})();
