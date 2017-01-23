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

            match: function(other) {
                return (
                    this.isAny() ||
                    other.isAny() ||
                    this.value === other.value
                );
            },

            above: function(other) {
                return (
                    this.isPrecise() &&
                    other.isPrecise() &&
                    this.value > other.value
                );
            },

            below: function(other) {
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

        function Version(firstArg) {
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
                minor = new VersionPart(0);
                patch = new VersionPart(0);
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
                    patch = new VersionPart(0);
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
        }
        Version.cast = function(firstArg) {
            var version;
            if (typeof firstArg === 'string') {
                version = new Version(firstArg);
            } else if (firstArg instanceof Version) {
                version = firstArg;
            } else {
                throw new Error('version.match expect a string or a version object');
            }
            return version;
        };
        Version.prototype = {
            constructor: Version,

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

        var versionSeparator = '@';
        var VersionnableProperties = {
            setName: function(firstArg) {
                var separatorIndex = firstArg.indexOf(versionSeparator);
                if (separatorIndex === -1) {
                    this.name = firstArg.toLowerCase();
                } else {
                    this.name = firstArg.slice(0, separatorIndex).toLowerCase();
                    var version = firstArg.slice(separatorIndex + versionSeparator.length);
                    this.setVersion(version);
                }
            },
            setVersion: function(version) {
                this.version = jsenv.createVersion(version);
            },
            toString: function() {
                var shortNotation = '';

                shortNotation += this.name;
                if (this.version.isSpecified()) {
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
            baseURL: baseURL, // from where am I running system-run
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
        Predicate.fails = function(fn) {
            return function() {
                try {
                    fn.apply(this, arguments);
                    return false;
                } catch (e) {
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
})();

/*
Cette seconde partie concerne les features et l'implementation de celle-ci
On s'en sert pour tester comment se comporte l'environnement et pouvoir réagir
en fonction du résultat de ces tests
*/
(function(jsenv) {
    var Iterable = jsenv.Iterable;
    var Predicate = jsenv.Predicate;

    function sameValues(a, b) {
        if (typeof a === 'string') {
            a = convertStringToArray(a);
        }
        if (typeof b === 'string') {
            b = convertStringToArray(b);
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
    function createIterableObject(arr, methods) {
        var i = 0;
        var j = arr.length;
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
        var iterable = {};
        iterable[Symbol.iterator] = function() {
            return iterator;
        };
        iterator.iterable = iterable;
        return iterable;
    }
    function collectKeys(value) {
        var keys = [];
        for (var key in value) {
            if (value.hasOwnProperty(key)) {
                if (isNaN(key) === false && value instanceof Array) {
                    keys.push(Number(key));
                } else {
                    keys.push(key);
                }
            }
        }
        return keys;
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

    jsenv.provide(function versionnedFeature() {
        function VersionnedFeature() {
            this.excluded = false;
            this.dependents = [];
            this.dependencies = [];
            this.parameters = [];
            jsenv.constructVersion(this, arguments);
        }
        VersionnedFeature.prototype = {
            constructor: VersionnedFeature,

            getPath: function() {
                var path = [];
                var selfOrParent = this;
                while (selfOrParent && selfOrParent.path) {
                    path.unshift(selfOrParent.path);
                    selfOrParent = selfOrParent.parent;
                }
                return path.join('.');
            },

            status: 'unspecified',
            // isValid & isInvalid or not opposite because status may be 'unspecified'
            isValid: function() {
                return this.status === 'valid';
            },
            isInvalid: function() {
                return this.status === 'invalid';
            },

            addDependency: function(dependency, asParameter) {
                if (dependency instanceof VersionnedFeature === false) {
                    throw new Error('addDependency first arg must be a feature');
                }
                if (Iterable.includes(this.dependents, dependency)) {
                    throw new Error('cyclic dependency between ' + dependency.name + ' and ' + this.name);
                }

                if (asParameter) {
                    this.parameters.push(dependency);
                } else if (dependency.excluded) {
                    this.excluded = true;
                }

                this.dependencies.push(dependency);
                dependency.dependents.push(this);
            },

            relyOn: function() {
                Iterable.forEach(arguments, function(arg) {
                    this.addDependency(arg, false);
                }, this);
            },

            parameterizedBy: function() {
                Iterable.forEach(arguments, function(arg) {
                    this.addDependency(arg, true);
                }, this);
            },
            // isParameterizedBy: function(feature) {
            //     return Iterable.includes(this.parameters, feature);
            // },
            isParameterOf: function(feature) {
                return Iterable.includes(this.parameters, feature);
            },

            exclude: function(reason) {
                this.excluded = true;
                this.exclusionReason = reason;
                Iterable.forEach(this.dependents, function(dependent) {
                    if (this.isParameterOf(dependent) === false) {
                        dependent.exclude(reason);
                    }
                }, this);
                return this;
            },
            include: function(reason) {
                this.excluded = false;
                this.exclusionReason = null;
                this.inclusionReason = reason;
                Iterable.forEach(this.dependencies, function(dependency) {
                    if (dependency.isParameterOf(this) === false) {
                        dependency.include(reason);
                    }
                }, this);
                return this;
            },
            isExcluded: function() {
                return this.excluded === true;
            },
            isIncluded: function() {
                return this.excluded !== true;
            }
        };
        jsenv.makeVersionnable(VersionnedFeature);

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

    jsenv.provide(function implementation() {
        function Implementation() {
            this.features = [];
        }
        Implementation.prototype = {
            constructor: Implementation,

            add: function(feature) {
                if (feature.name === '') {
                    throw new Error('cannot add a feature with empty name');
                }

                var existingFeature = this.find(feature);
                if (existingFeature) {
                    throw new Error('The feature ' + existingFeature + ' already exists');
                }
                this.features.push(feature);
                return feature;
            },

            find: function(searchedFeature) {
                return Iterable.find(this.features, function(feature) {
                    return feature.match(searchedFeature);
                });
            },

            get: function() {
                var searchedFeature = jsenv.createFeature.apply(this, arguments);
                var foundVersionnedFeature = this.find(searchedFeature);
                if (!foundVersionnedFeature) {
                    throw new Error('feature not found ' + searchedFeature);
                }
                return foundVersionnedFeature;
            },

            support: function() {
                var versionnedFeature = this.get.apply(this, arguments);
                if (versionnedFeature) {
                    return versionnedFeature.isValid();
                }
                return false;
            },

            include: function(featureName) {
                this.get(featureName).include();
                return this;
            },

            exclude: function(featureName, reason) {
                this.get(featureName).exclude(reason);
                return this;
            },

            scan: function(callback) {
                if (this.preventScanReason) {
                    throw new Error('cannot scan, reason :' + this.preventScanReason);
                }
                this.preventScanReason = 'there is already a pending scan';

                var self = this;
                var includedFeatures = Iterable.filter(this.features, function(feature) {
                    return feature.isIncluded();
                });
                var groups = groupNodesByDependencyDepth(includedFeatures);
                var groupIndex = -1;
                var groupCount = groups.length;
                var done = function() {
                    var statusGroups = {
                        unspecified: [],
                        invalid: [],
                        valid: []
                    };
                    Iterable.forEach(includedFeatures, function(feature) {
                        statusGroups[feature.status].push(feature);
                    });
                    var report = {
                        features: self.features,
                        includedAndGroupedByDependencyDepth: groups
                    };
                    jsenv.assign(report, statusGroups);
                    self.preventScanReason = undefined;
                    callback(report);
                };

                function nextGroup() {
                    groupIndex++;
                    if (groupIndex === groupCount) {
                        // il faut faire setTimeout sur done
                        // je ne sais pas trop pourquoi sinon nodejs cache les erreurs qui pourraient
                        // être throw par done ou le callback
                        setTimeout(done);
                    } else {
                        var group = groups[groupIndex];
                        var i = 0;
                        var j = group.length;
                        var readyCount = 0;

                        while (i < j) {
                            var feature = group[i];
                            feature.updateStatus(function() { // eslint-disable-line
                                readyCount++;
                                if (readyCount === j) {
                                    nextGroup();
                                }
                            });
                            i++;
                        }
                    }
                }
                nextGroup();
            }
        };

        function groupNodesByDependencyDepth(nodes) {
            var unresolvedNodes = nodes.slice();
            var i = 0;
            var j = unresolvedNodes.length;
            var resolvedNodes = [];
            var groups = [];
            var group;

            while (true) { // eslint-disable-line
                group = [];
                i = 0;
                while (i < j) {
                    var unresolvedNode = unresolvedNodes[i];
                    var everyDependencyIsResolved = Iterable.every(unresolvedNode.dependencies, function(dependency) {
                        return Iterable.includes(resolvedNodes, dependency);
                    });
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
            implementation: new Implementation()
        };
    });

    jsenv.provide(function registerFeature() {
        var implementation = jsenv.implementation;

        function compileFunction(names, body) {
            var args = [];
            args.push.apply(args, names);
            args.push(body);
            return jsenv.construct(Function, args);
        }
        // function extractFunctionBodyComment(fn) {
        //     return fn.toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
        // }
        // function camelToHyphen(string) {
        //     var i = 0;
        //     var j = string.length;
        //     var camelizedResult = '';
        //     while (i < j) {
        //         var letter = string[i];
        //         var action;

        //         if (i === 0) {
        //             action = 'lower';
        //         } else if (isUpperCaseLetter(letter)) {
        //             if (isUpperCaseLetter(string[i - 1])) { // toISOString -> to-iso-string & toJSON -> to-json
        //                 if (i === j - 1) { // toJSON on the N
        //                     action = 'lower';
        //                 } else if (isLowerCaseLetter(string[i + 1])) { // toISOString on the S
        //                     action = 'camelize';
        //                 } else { // toJSON on the SO
        //                     action = 'lower';
        //                 }
        //             } else if (
        //                 isLowerCaseLetter(string[i - 1]) &&
        //                 i > 1 &&
        //                 isUpperCaseLetter(string[i - 2])
        //             ) { // isNaN -> is-nan
        //                 action = 'lower';
        //             } else {
        //                 action = 'camelize';
        //             }
        //         } else {
        //             action = 'concat';
        //         }

        //         if (action === 'lower') {
        //             camelizedResult += letter.toLowerCase();
        //         } else if (action === 'camelize') {
        //             camelizedResult += '-' + letter.toLowerCase();
        //         } else if (action === 'concat') {
        //             camelizedResult += letter;
        //         } else {
        //             throw new Error('unknown camelize action');
        //         }

        //         i++;
        //     }
        //     return camelizedResult;
        // }
        // function isUpperCaseLetter(letter) {
        //     return /[A-Z]/.test(letter);
        // }
        // function isLowerCaseLetter(letter) {
        //     return /[a-z]/.test(letter);
        // }
        var noValue = {novalue: true};
        function runStandard(feature) {
            var result;
            // désactive hasOwnProperty result sinon on ne peut pas relancer le test
            // puisque une fois le test fait une fois, feature.result existe
            // ou alors il faudrais delete feature.result pour relancer le test
            if (false && feature.hasOwnProperty('result')) {
                result = feature.result;
            } else if (feature.parent) {
                var startValue = feature.parent.result;
                var path = feature.path;
                var parts = path.split('.');
                var endValue = startValue;
                var i = 0;
                var j = parts.length;
                while (i < j) {
                    var part = parts[i];
                    if (part in endValue) {
                        endValue = endValue[part];
                    } else {
                        endValue = noValue;
                        break;
                    }
                    i++;
                }
                result = endValue;
            } else {
                throw new Error('feature without parent must have a result property');
            }
            return result;
        }
        function presence(result, settle) {
            if (result === noValue) {
                settle(false, 'missing');
            } else {
                settle(true, 'present');
            }
        }
        // function ensureKind(expectedKind) {
        //     return function(result, settle) {
        //         var actualKind;

        //         if (expectedKind === 'object' && result === null) {
        //             actualKind = 'null';
        //         } else if (expectedKind === 'symbol') {
        //             if (result && result.constructor === Symbol) {
        //                 actualKind = 'symbol';
        //             } else {
        //                 actualKind = typeof result;
        //             }
        //         } else {
        //             actualKind = typeof result;
        //         }

        //         if (actualKind === expectedKind) {
        //             settle(true, 'expected-' + actualKind);
        //         } else {
        //             settle(false, 'unexpected-' + actualKind);
        //         }
        //     };
        // }
        // function composeSettlers(settlers) {
        //     return function() {
        //         var i = 0;
        //         var j = settlers.length;
        //         var statusValid;
        //         var statusReason;
        //         var statusDetail;
        //         var handledCount = 0;
        //         var args = Array.prototype.slice.call(arguments);
        //         var lastArgIndex = args.length - 1;
        //         var settle = args[lastArgIndex];

        //         function compositeSettle(valid, reason, detail) {
        //             handledCount++;

        //             statusValid = valid;
        //             statusReason = reason;
        //             statusDetail = detail;

        //             var settled = false;
        //             if (statusValid) {
        //                 settled = handledCount === j;
        //             } else {
        //                 settled = true;
        //             }

        //             if (settled) {
        //                 settle(statusValid, statusReason, statusDetail);
        //             }
        //         }

        //         args[lastArgIndex] = compositeSettle;

        //         while (i < j) {
        //             settlers[i].apply(this, args);
        //             if (statusValid === false) {
        //                 break;
        //             }
        //             i++;
        //         }
        //     };
        // }
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
        function findParentFromFeatureName(featureName) {
            var parent = null;
            var parts = featureName.split('-');
            var i = parts.length;
            if (i > 1) {
                while (i > 1) {
                    var possibleParentName = parts.slice(0, i - 1).join('-');
                    var possibleParent = implementation.find(jsenv.createFeature(possibleParentName));
                    if (possibleParent) {
                        parent = possibleParent;
                        break;
                    }
                    i--;
                }
            }
            return parent;
        }

        var featurePrototype = Object.getPrototypeOf(jsenv.createFeature());
        featurePrototype.test = function() {
            return false;
        };
        featurePrototype.compileTest = function() {
            var test;
            if (this.hasOwnProperty('test')) {
                var ownTest = this.test;
                if (typeof ownTest === 'function') {
                    test = ownTest;
                } else {
                    throw new TypeError('feature test must be a function');
                }
            } else {
                test = this.parent ? this.parent.test : this.test;
            }
            return test;
        };
        featurePrototype.config = {};
        featurePrototype.compileConfig = function() {
            var config = {};
            if (this.hasOwnProperty('config')) {
                var ownConfig = this.config;

                if (typeof ownConfig === 'function') {
                    config = ownConfig.call(this);
                } else if (typeof ownConfig === 'object') {
                    config = ownConfig;
                } else {
                    throw new TypeError('feature config must be an object or function');
                }

                var parent = this.parent;
                if (parent) {
                    var inheritedConfig = {};
                    jsenv.assign(inheritedConfig, parent.config);
                    jsenv.assign(inheritedConfig, config);
                    config = inheritedConfig;
                }
            } else {
                config = this.parent ? this.parent.config : this.config;
            }
            this.config = config;
            return config;
        };
        featurePrototype.compileRunArgs = function() {
            var config = this.config;
            var runArgs = Object.keys(config).map(function(key) {
                return config[key];
            });
            return runArgs;
        };
        featurePrototype.compileRun = function() {
            var run;
            if (this.hasOwnProperty('run')) {
                var ownRun = this.run;
                if (typeof ownRun === 'string') {
                    run = compileFunction(Object.keys(this.config), ownRun);
                } else if (typeof ownRun === 'function') {
                    run = ownRun;
                } else {
                    throw new TypeError('feature run must be a string or function');
                }
            } else {
                run = this.parent ? this.parent.run : function() {
                    return this.config;
                };
            }
            this.run = run;
            return run;
        };
        featurePrototype.testPhase = 'return';
        featurePrototype.updateStatus = function(callback) {
            var feature = this;

            if (feature.statusIsFrozen) {
                callback(feature);
            } else {
                var settled = false;
                var settle = function(valid, reason, detail) {
                    if (settled === false) {
                        var arity = arguments.length;

                        if (arity === 0) {
                            feature.status = 'unspecified';
                            feature.statusReason = undefined;
                            feature.statusDetail = undefined;
                        } else {
                            feature.status = valid ? 'valid' : 'invalid';
                            feature.statusReason = reason;
                            feature.statusDetail = detail;
                        }

                        settled = true;
                        callback(feature);
                    }
                };

                var dependencies = feature.dependencies;
                var invalidDependency = Iterable.find(dependencies, function(dependency) {
                    return dependency.isInvalid() && dependency.isParameterOf(this) === false;
                }, this);
                if (invalidDependency) {
                    settle(false, 'dependency-is-invalid', invalidDependency);
                } else {
                    var config;
                    var runArgs;
                    var run;
                    var test = this.compileTest();
                    var throwedValue;
                    var hasThrowed = false;
                    var phase;

                    if (!test) {
                        throw new Error('feature ' + this + ' has no test');
                    }

                    phase = 'compile';
                    try {
                        config = this.compileConfig();
                        runArgs = this.compileRunArgs(config);
                        run = this.compileRun();
                    } catch (e) {
                        hasThrowed = true;
                        throwedValue = e;
                    }

                    var result;
                    if (hasThrowed) {
                        result = throwedValue;
                    } else {
                        phase = 'call';
                        try {
                            result = run.apply(this, runArgs);
                        } catch (e) {
                            hasThrowed = true;
                            throwedValue = e;
                        }

                        if (hasThrowed) {
                            result = throwedValue;
                        } else {
                            phase = 'return';
                        }
                    }

                    this.phase = phase;
                    if (this.phase === phase) {
                        this.result = result;

                        var testArgs = [];
                        var testHasThrowed = false;
                        var testThrowedValue;

                        testArgs.push(result);
                        Iterable.forEach(this.parameters, function(parameter) {
                            testArgs.push(parameter);
                        });
                        testArgs.push(settle);

                        var testSettler = convertToSettler(test);

                        try {
                            testSettler.apply(
                                feature,
                                testArgs
                            );

                            var maxDuration = 100;
                            setTimeout(function() {
                                settle(false, 'timeout', maxDuration);
                            }, maxDuration);
                        } catch (e) {
                            testHasThrowed = true;
                            testThrowedValue = e;
                        }

                        if (testHasThrowed) {
                            settle(false, 'throwed', testThrowedValue);
                        }
                    } else {
                        settle(false, 'unexpected-phase:' + phase, result);
                    }
                }
            }

            return this;
        };
        featurePrototype.ensure = function(dependentFeature) {
            dependentFeature.parent = this;
            dependentFeature.type = this.type;
            dependentFeature.relyOn(this);
            return this;
        };

        var globalStandard = jsenv.createFeature('global');
        globalStandard.type = 'standard';
        // globalStandard.result = jsenv.global;
        globalStandard.run = function() {
            return jsenv.global;
        };
        globalStandard.test = presence;
        implementation.add(globalStandard);

        function standard(name, test, disableNameRelationShip) {
            var feature = jsenv.createFeature(name);
            var parent;

            if (disableNameRelationShip) {
                parent = globalStandard;
            } else {
                parent = findParentFromFeatureName(name) || globalStandard;
            }

            parent.ensure(feature);

            if (typeof test === 'string') {
                feature.path = test;
                feature.run = function() {
                    return runStandard(this);
                };
                feature.test = presence;
            } else if (typeof test === 'function') {
                feature.test = test;
                feature.run = function() {
                    return parent.result;
                };
                feature.test = test;
            } else if (jsenv.isFeature(test)) {
                var dependency = test;
                feature.relyOn(dependency);
                feature.path = parent.getPath() + '[' + dependency.getPath() + ']';
                feature.run = function() {
                    var fromValue = parent.result;
                    var dependencyValue = dependency.result;

                    if (dependencyValue in fromValue) {
                        return fromValue[dependencyValue];
                    }
                    return noValue;
                };
                feature.test = presence;
            }

            implementation.add(feature);
            return feature;
        }

        function registerSyntax(name, descriptor) {
            var feature = jsenv.createFeature(name);
            var parent = findParentFromFeatureName(name);

            if (parent) {
                parent.ensure(feature);
            }

            feature.type = 'syntax';
            if ('dependencies' in descriptor) {
                var dependencies = Iterable.map(descriptor.dependencies, function(dependencyName) { // eslint-disable-line
                    return implementation.get(dependencyName);
                });
                feature.relyOn.apply(feature, dependencies);
            }
            if ('parameters' in descriptor) {
                var parameters = Iterable.map(descriptor.parameters, function(parameterName) { // eslint-disable-line
                    return implementation.get(parameterName);
                });
                feature.parameterizedBy.apply(feature, parameters);
            }
            if ('config' in descriptor) {
                feature.config = descriptor.config;
            }
            if ('run' in descriptor) {
                feature.run = descriptor.run;
            }
            if ('test' in descriptor) {
                feature.test = descriptor.test;
            }
            if ('phase' in descriptor) {
                feature.phase = descriptor.phase;
            }

            implementation.add(feature);
            return feature;
        }

        return {
            registerStandard: standard,
            registerSyntax: registerSyntax
        };
    });

    jsenv.provide(function registerStandardFeatures() {
        var standard = jsenv.registerStandard;

        standard('system', 'System');
        standard('promise', 'Promise');
        standard('promise-unhandled-rejection', function(Promise, settle) {
            var promiseRejectionEvent;
            var unhandledRejection = function(e) {
                promiseRejectionEvent = e;
            };

            if (jsenv.isBrowser()) {
                if ('onunhandledrejection' in window === false) {
                    return settle(false);
                }
                window.onunhandledrejection = unhandledRejection;
            } else if (jsenv.isNode()) {
                process.on('unhandledRejection', function(value, promise) {
                    unhandledRejection({
                        promise: promise,
                        reason: value
                    });
                });
            } else {
                return settle(false);
            }

            Promise.reject('foo');
            setTimeout(function() {
                var valid = (
                    promiseRejectionEvent &&
                    promiseRejectionEvent.reason === 'foo'
                );
                // to be fully compliant we shoudl ensure
                // promiseRejectionEvent.promise === the promise rejected above
                // BUT it seems corejs dos not behave that way
                // and I'm not 100% sure what is the expected promise object here
                settle(valid);
            }, 10); // engine has 10ms to trigger the event
        });
        standard('promise-rejection-handled', function(Promise, settle) {
            var promiseRejectionEvent;
            var rejectionHandled = function(e) {
                promiseRejectionEvent = e;
            };

            if (jsenv.isBrowser()) {
                if ('onrejectionhandled' in window === false) {
                    return settle(false);
                }
                window.onrejectionhandled = rejectionHandled;
            } else if (jsenv.isNode()) {
                process.on('rejectionHandled', function(promise) {
                    rejectionHandled({promise: promise});
                });
            } else {
                return settle(false);
            }

            var promise = Promise.reject('foo');
            setTimeout(function() {
                promise.catch(function() {});
                setTimeout(function() {
                    settle(
                        promiseRejectionEvent &&
                        promiseRejectionEvent.promise === promise
                    );
                    // node event emit the value
                    // so we can't check for
                    // promiseRejectionEvent.reason === 'foo'
                }, 10); // engine has 10ms to trigger the event
            });
        });
        standard('symbol', 'Symbol');
        standard('symbol-iterator', 'iterator');
        standard('symbol-to-primitive', 'toPrimitive');
        standard('object', 'Object');
        standard('object-get-own-property-descriptor', 'getOwnPropertyDescriptor');
        standard('date', 'Date');
        standard('date-now', 'now');
        standard('date-prototype', 'prototype');
        standard('date-prototype-to-json', 'toJSON');
        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
        standard('date-prototype-to-json-nan-return-null', function() {
            return new Date(NaN).toJSON() === null;
        });
        standard('date-prototype-to-json-use-to-iso-string', function() {
            var fakeDate = {
                toISOString: function() {
                    return 1;
                }
            };
            return Date.prototype.toJSON.call(fakeDate) === 1;
        });
        standard('date-prototype-to-iso-string', 'toISOString');
        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
        standard('date-prototype-to-iso-string-negative-5e13', function() {
            return new Date(-5e13 - 1).toISOString() === '0385-07-25T07:06:39.999Z';
        });
        standard('date-prototype-to-iso-string-nan-throw', Predicate.fails(function() {
            new Date(NaN).toISOString(); // eslint-disable-line no-unused-expressions
        }));
        standard('date-prototype-symbol-to-primitive', jsenv.implementation.get('symbol-to-primitive'));
        standard('date-prototype-to-string', 'toString');
        standard('date-prototype-to-string-nan-return-invalid-date', function() {
            // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
            return new Date(NaN).toString() === 'Invalid Date';
        });
        standard('array', 'Array');
        standard('array-prototype', 'prototype');
        standard('array-prototype-symbol-iterator', jsenv.implementation.get('symbol-iterator'));
        standard('array-prototype-symbol-iterator-sparse', function(arrayIterator) {
            var sparseArray = [,,]; // eslint-disable-line no-sparse-arrays, comma-spacing
            var iterator = arrayIterator.call(sparseArray);
            var values = consumeIterator(iterator);

            return sameValues(values, sparseArray);
        });

        standard('function', 'Function');
        standard('function-prototype', 'prototype');
        standard('function-prototype-name', 'name');
        standard('function-prototype-name-description', function() {
            var descriptor = Object.getOwnPropertyDescriptor(
                function f() {},
                'name'
            );

            return (
                descriptor.enumerable === false &&
                descriptor.writable === false &&
                descriptor.configurable === true
            );
        });

        standard('string', 'String');
        standard('string-prototype', 'prototype');
        standard('string-prototype-symbol-iterator', jsenv.implementation.get('symbol-iterator'));
        standard('string-prototype-symbol-iterator-basic', function(stringIterator) {
            var string = '1234';
            var iterator = stringIterator.call(string);
            var values = consumeIterator(iterator);

            return sameValues(values, string);
        });
        standard('string-prototype-symbol-iterator-astral', function(stringIterator) {
            var astralString = '𠮷𠮶';
            var iterator = stringIterator.call(astralString);
            var values = consumeIterator(iterator);

            return sameValues(values, astralString);
        });

        standard('url', 'URL');
        standard('url-search-params', 'URLSearchParams', true);

        /*
        if (jsenv.isBrowser() === false) {
            implementation.exclude('node-list');
            // etc
            // en gros on exclu certains features quand on est pas dans le browser
        }
        */
    });

    jsenv.provide(function registerSyntaxFeatures() {
        var syntax = jsenv.registerSyntax;

        // internal dependency level: 0
        syntax('const', {
            config: {
                value: 123
            },
            run: '\
                const result = value;\
                return result;\
            ',
            test: function(result) {
                return result === this.config.value;
            }
        });
        syntax('const-throw-statement', {
            run: '\
                if (true) const bar = 1;\
            ',
            phase: 'compile',
            test: function(error) {
                return error instanceof Error;
            }
        });
        syntax('const-throw-redefine', {
            run: '\
                const foo = 1;\
                foo = 2;\
            ',
            phase: 'call',
            test: function(error) {
                return error instanceof Error;
            }
        });
        syntax('const-temporal-dead-zone', {
            config: {
                value: 10
            },
            run: '\
                var result;\
                function fn() {\
                    result = foo;\
                }\
                const foo = value;\
                fn();\
                return result;\
            ',
            test: function(result) {
                return result === this.config.value;
            }
        });
        syntax('const-scoped', {
            config: {
                outsideValue: 0,
                insideValue: 1
            },
            run: '\
                const result = outsideValue;\
                {\
                    const result = insideValue;\
                }\
                return result;\
            ',
            test: function(result) {
                return result === this.config.outsideValue;
            }
        });
        syntax('const-scoped-for-statement', {
            run: '\
                const foo = outsideValue;\
                for(const foo = insideValue; false;) {}\
                return foo;\
            ',
            test: function(result) {
                return result === this.config.outsideValue;
            }
        });
        syntax('const-scoped-for-body', {
            config: {
                value: [0, 1]
            },
            run: '\
                var scopes = [];\
                for(const i in value) {\
                    scopes.push(function() {\
                        return i;\
                    });\
                }\
                return scopes;\
            ',
            test: function(result) {
                var scopedValues = jsenv.Iterable.map(result, function(fn) {
                    return fn();
                });
                var value = this.config.value;
                var expectedValues = [];
                for (var i in value) { // eslint-disable-line guard-for-in
                    expectedValues.push(i);
                }
                return sameValues(scopedValues, expectedValues);
            }
        });

        syntax('let', {
            config: {
                value: 123
            },
            run: '\
                let result = value;\
                return result;\
            ',
            test: function(result) {
                return result === this.config.value;
            }
        });
        syntax('let-throw-statement', {
            run: '\
                if (true) let result = 1;\
            ',
            phase: 'compile',
            test: function(error) {
                return error instanceof Error;
            }
        });
        syntax('let-temporal-dead-zone', {
            config: {
                value: 10
            },
            run: '\
                var result;\
                function fn() {\
                    result = foo;\
                }\
                let foo = value;\
                fn();\
                return result;\
            ',
            test: function(result) {
                return result === this.config.value;
            }
        });
        syntax('let-scoped', {
            config: {
                outsideValue: 0,
                insideValue: 1
            },
            run: '\
                let result = outsideValue;\
                {\
                    let result = insideValue;\
                }\
                return result;\
            ',
            test: function(result) {
                return result === this.config.outsideValue;
            }
        });
        syntax('let-scoped-for-statement', {
            run: '\
                let result = outsideValue;\
                for(let result = insideValue; false;) {}\
                return result;\
            ',
            test: function(result) {
                return result === this.config.outsideValue;
            }
        });
        syntax('let-scoped-for-body', {
            config: {
                value: [0, 1]
            },
            run: '\
                var scopes = [];\
                for(let i in value) {\
                    scopes.push(function() {\
                        return i;\
                    });\
                }\
                return scopes;\
            ',
            test: function(result) {
                var scopedValues = jsenv.Iterable.map(result, function(fn) {
                    return fn();
                });
                var value = this.config.value;
                var expectedValues = [];
                for (var i in value) { // eslint-disable-line guard-for-in
                    expectedValues.push(i);
                }
                return sameValues(scopedValues, expectedValues);
            }
        });

        syntax('computed-properties', {
            config: {
                name: 'y',
                value: 1
            },
            run: '\
                return {[name]: value};\
            ',
            test: function(result) {
                return result[this.config.name] === this.config.value;
            }
        });

        syntax('shorthand-properties', {
            config: {
                a: 1,
                b: 2
            },
            run: '\
                return {a, b};\
            ',
            test: function(result) {
                return (
                    result.a === this.config.a &&
                    result.b === this.config.b
                );
            }
        });
        syntax('shorthand-methods', {
            config: {
                value: {}
            },
            run: '\
                return {\
                    y() {\
                        return value;\
                    }\
                };\
            ',
            test: function(result) {
                return result.y() === this.config.value;
            }
        });

        syntax('spread-function-call', {
            config: {
                method: Math.max,
                value: [1, 2, 3]
            },
            run: '\
                return method(...value);\
            ',
            test: function(result) {
                return result === this.config.method.apply(null, this.config.value);
            }
        });
        syntax('spread-function-call-throw-non-iterable', {
            config: {
                value: true
            },
            phase: 'call',
            test: function(error) {
                return error instanceof Error;
            }
        });
        syntax('spread-function-call-iterable', {
            dependencies: [
                'symbol-iterator'
            ],
            config: {
                method: Math.max,
                value: createIterableObject([1, 2, 3])
            },
            test: function(result) {
                return result === this.config.method.apply(null, [1, 2, 3]);
            }
        });
        syntax('spread-function-call-iterable-instance', {
            config: {
                method: Math.max,
                value: Object.create(createIterableObject([1, 2, 3]))
            },
            test: function(result) {
                return result === this.config.method.apply(null, [1, 2, 3]);
            }
        });
        syntax('spread-literal-array', {
            config: {
                value: [1, 2, 3]
            },
            run: '\
                return [...value];\
            ',
            test: function(result) {
                return sameValues(result, this.config.value);
            }
        });
        syntax('spread-literal-array-iterable', {
            dependencies: [
                'symbol-iterator'
            ],
            config: {
                value: createIterableObject([1, 2, 3])
            },
            test: function(result) {
                return sameValues(result, [1, 2, 3]);
            }
        });
        syntax('spread-literal-array-iterable-instance', {
            config: {
                value: Object.create(createIterableObject([1, 2, 3]))
            },
            test: function(result) {
                return sameValues(result, [1, 2, 3]);
            }
        });

        syntax('for-of', {
            dependencies: [
                'array-prototype-symbol-iterator'
            ],
            config: {
                iterable: [5]
            },
            run: '\
                var result = [];\
                for (var value of iterable) {\
                    result.push(value);\
                }\
                return result;\
            ',
            test: function(result) {
                return result[0] === 5;
            }
        });
        syntax('for-of-iterable-generic', {
            dependencies: [
                'symbol-iterator'
            ],
            config: function() {
                return {
                    iterable: createIterableObject([1, 2, 3])
                };
            },
            test: function(result) {
                return sameValues(result, [1, 2, 3]);
            }
        });
        syntax('for-of-iterable-generic-instance', {
            config: function() {
                return {
                    iterable: Object.create(createIterableObject([1, 2, 3]))
                };
            },
            test: function(result) {
                return sameValues(result, [1, 2, 3]);
            }
        });
        syntax('for-of-iterable-return-called-on-break', {
            config: function() {
                return {
                    iterable: createIterableObject([1], {
                        'return': function() { // eslint-disable-line
                            this.iterable.returnCalled = true;
                            return {};
                        }
                    })
                };
            },
            run: '\
                for (var it of iterable) {\
                    break;\
                }\
            ',
            test: function() {
                return this.config.iterable.returnCalled;
            }
        });
        syntax('for-of-iterable-return-called-on-throw', {
            config: function() {
                return {
                    throwedValue: 0,
                    iterable: createIterableObject([1], {
                        'return': function() { // eslint-disable-line
                            this.iterable.returnCalled = true;
                            return {};
                        }
                    })
                };
            },
            run: '\
                for (var it of iterable) {\
                    throw throwedValue;\
                }\
            ',
            phase: 'call',
            test: function(error) {
                return (
                    error === this.config.throwedValue &&
                    this.config.iterable.returnCalled
                );
            }
        });

        syntax('function-prototype-name-statement', {
            run: function() {
                function foo() {}

                return [
                    foo,
                    (function() {})
                ];
            },
            test: function(result) {
                return (
                    result[0].name === 'foo' &&
                    result[1].name === ''
                );
            }
        });
        syntax('function-prototype-name-expression', {
            run: function() {
                return [
                    (function foo() {}),
                    (function() {})
                ];
            },
            test: function(result) {
                return (
                    result[0].name === 'foo' &&
                    result[1].name === ''
                );
            }
        });
        syntax('function-prototype-name-new', {
            run: function() {
                return (new Function()); // eslint-disable-line no-new-func
            },
            test: function(result) {
                return result.name === 'anonymous';
            }
        });
        syntax('function-prototype-name-bind', {
            run: function() {
                function foo() {}

                return {
                    boundFoo: foo.bind({}),
                    boundAnonymous: (function() {}).bind({}) // eslint-disable-line no-extra-bind
                };
            },
            test: function(result) {
                return (
                    result.boundFoo.name === "bound foo" &&
                    result.boundAnonymous.name === "bound "
                );
            }
        });
        syntax('function-prototype-name-var', {
            run: function() {
                var foo = function() {};
                var bar = function baz() {};

                return {
                    foo: foo,
                    bar: bar
                };
            },
            test: function(result) {
                return (
                    result.foo.name === "foo" &&
                    result.bar.name === "baz"
                );
            }
        });
        syntax('function-prototype-name-accessor', {
            run: '\
                return {\
                    get foo() {},\
                    set foo(x) {}\
                };\
            ',
            test: function(result) {
                var descriptor = Object.getOwnPropertyDescriptor(result, 'foo');

                return (
                    descriptor.get.name === 'get foo' &&
                    descriptor.set.name === 'set foo'
                );
            }
        });
        syntax('function-prototype-name-method', {
            run: function() {
                var o = {
                    foo: function() {},
                    bar: function baz() {}
                };
                o.qux = function() {};
                return o;
            },
            test: function(result) {
                return (
                    result.foo.name === 'foo' &&
                    result.bar.name === 'baz' &&
                    result.qux.name === ''
                );
            }
        });

        syntax('function-default-parameters', {
            config: {
                values: [3]
            },
            run: '\
                function f(a = 1, b = 2) {\
                    return {a: a, b: b};\
                }\
                return f.apply(null, values);\
            ',
            test: function(result) {
                return (
                    result.a === this.config.values[0] &&
                    result.b === 2
                );
            }
        });
        syntax('function-default-parameters-explicit-undefined', {
            config: {
                values: [undefined, 3]
            },
            test: function(result) {
                return (
                    result.a === 1 &&
                    result.b === this.config.values[1]
                );
            }
        });
        syntax('function-default-parameters-refer-previous', {
            run: '\
                function f(a = 1, b = a) {\
                    return {a: a, b: b};\
                }\
                return f.apply(null, values);\
            ',
            test: function(result) {
                return (
                    result.a === this.config.values[0] &&
                    result.b === this.config.values[0]
                );
            }
        });
        syntax('function-default-parameters-arguments', {
            config: {
                values: [5, 6]
            },
            run: '\
                function f(a = 1, b = 2, c = 3) {\
                    a = 10;\
                    return arguments;\
                }\
                return f.apply(null, values);\
            ',
            test: function(result) {
                return sameValues(result, this.config.values);
            }
        });
        syntax('function-default-parameters-temporal-dead-zone', {
            run: '\
                (function(a = a) {}());\
                (function(a = b, b){}());\
            ',
            test: function() {
                return true;
            }
        });
        syntax('function-default-parameters-scope-separated', {
            run: '\
                function fn(a = function() {\
                    return {b: b};\
                }) {\
                    var b = 1;\
                    return a;\
                }\
                return fn;\
            ',
            test: function(result) {
                return typeof result().b === 'undefined';
            }
        });
        syntax('function-default-parameters-new-function', {
            config: {
                defaultValues: [1, 2],
                values: [3]
            },
            run: function() {
                return new Function( // eslint-disable-line no-new-func
                    "a = " + this.config.defaultValues[0], "b = " + this.config.defaultValues[1],
                    "return {a: a, b: b}"
                ).apply(null, this.config.values);
            },
            test: function(result) {
                return (
                    result.a === this.config.values[0] &&
                    result.b === this.config.defaultValues[1]
                );
            }
        });

        syntax('function-rest-parameters', {
            config: {
                values: [0, 1, 2]
            },
            run: '\
                function fn(foo, ...rest) {\
                    return {foo: foo, rest: rest};\
                }\
                return fn.apply(null, values);\
            ',
            test: function(result) {
                return (
                    result.rest instanceof Array &&
                    sameValues(result.rest, this.config.values.slice(1))
                );
            }
        });
        syntax('function-rest-parameters-throw-setter', {
            run: '\
                return {\
                    set e(...args) {}\
                };\
            ',
            phase: 'compile',
            test: function(error) {
                return error instanceof Error;
            }
        });
        syntax('function-rest-parameters-length', {
            run: '\
                return [\
                    function(a, ...b) {},\
                    function(...c) {}\
                ];\
            ',
            test: function(result) {
                return (
                    result[0].length === 1 &&
                    result[1].length === 0
                );
            }
        });
        syntax('function-rest-parameters-arguments', {
            run: '\
                function fn(foo, ...rest) {\
                    foo = 10;\
                    return arguments;\
                }\
                return fn.apply(null, values);\
            ',
            test: function(result) {
                return sameValues(result, this.config.values);
            }
        });

        syntax('function-rest-parameters-new-function', {
            run: function() {
                return new Function( // eslint-disable-line no-new-func
                    "a", "...rest",
                    "return {a: a, rest: rest}"
                ).apply(null, this.config.values);
            },
            test: function(result) {
                return (
                    result.a === this.config.values[0] &&
                    sameValues(result.rest, this.config.values.slice(1))
                );
            }
        });

        // internal dependency level: 1
        syntax('const-scoped-for-of-body', {
            dependencies: ['for-of'],
            config: {
                value: [0, 1]
            },
            run: '\
                var scopes = [];\
                for(const i of value) {\
                    scopes.push(function() {\
                        return i;\
                    });\
                }\
                return scopes;\
            ',
            test: function(result) {
                var scopedValues = jsenv.Iterable.map(result, function(fn) {
                    return fn();
                });
                return sameValues(scopedValues, collectKeys(this.config.value));
            }
        });
        syntax('function-prototype-name-method-shorthand', {
            dependencies: [
                'shorthand-methods'
            ],
            run: '\
                return {\
                    foo() {}\
                };\
            ',
            test: function(result) {
                return result.foo.name === 'foo';
            }
        });
        syntax('function-prototype-name-method-shorthand-lexical-binding', {
            dependencies: [
                'shorthand-methods'
            ],
            run: '\
                var f = \'foo\';\
                return ({\
                    f() {\
                        return f;\
                    }\
                });\
            ',
            test: function(result) {
                return result.f() === 'foo';
            }
        });
        syntax('function-prototype-name-method-computed-symbol', {
            dependencies: [
                'symbol',
                'computed-properties'
            ],
            config: function() {
                return {
                    first: Symbol("foo"),
                    second: Symbol()
                };
            },
            run: '\
                return {\
                    [first]: function() {},\
                    [second]: function() {}\
                };\
            ',
            test: function(result) {
                return (
                    result[this.config.first].name === '[foo]' &&
                    result[this.config.second].name === ''
                );
            }
        });
        // syntax('spread-function-call-generator', {
        //     // dependencies: ['yield'],
        //     args: '\
        //         return {\
        //             value: (function*() {\
        //                 yield 1;\
        //                 yield 2;\
        //                 yield 3;\
        //             }())\
        //         };\
        //     ',
        //     test: function(result) {
        //         return result === 3;
        //     }
        // });
        // syntax('spread-literal-array-generator', {
        //     args: '\
        //         return {\
        //             value: (function*() {\
        //                 yield 1;\
        //                 yield 2;\
        //                 yield 3;\
        //             }())\
        //         };\
        //     ',
        //     test: function(result) {
        //         return sameValues(result, [1, 2, 3]);
        //     }
        // });
        // syntax('for-of-generator', {
        //     // dependencies: ['yield'],
        //     body: '\
        //         var result = "";\
        //         var iterable = (function*() {\
        //             yield 1;\
        //             yield 2;\
        //             yield 3;\
        //         }());\
        //         for (var item of iterable) {\
        //             result += item;\
        //         }\
        //         return result;\
        //     ',
        //     test: function(result) {
        //         return result === '123';
        //     }
        // });
    });
})(jsenv);
