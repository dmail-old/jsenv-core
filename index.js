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

    jsenv.provide(function versionnedFeature() {
        function VersionnedFeature() {
            this.dependents = [];
            this.dependencies = [];
            this.parameters = [];
            jsenv.constructVersion(this, arguments);
        }
        VersionnedFeature.prototype = {
            constructor: VersionnedFeature,
            enabled: true,

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
                } else if (dependency.isDisabled()) {
                    this.disable();
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

            enable: function(featureName) {
                this.get(featureName).enable();
                return this;
            },

            disable: function(featureName, reason) {
                this.get(featureName).disable(reason);
                return this;
            },

            scan: function(callback) {
                if (this.preventScanReason) {
                    throw new Error('cannot scan, reason :' + this.preventScanReason);
                }
                this.preventScanReason = 'there is already a pending scan';

                var self = this;
                var features = this.features;
                var groups = groupNodesByDependencyDepth(features);
                var groupIndex = -1;
                var groupCount = groups.length;
                var done = function() {
                    var invalidFeatures = jsenv.Iterable.filter(self.features, function(feature) {
                        return feature.isInvalid();
                    });
                    var invalidFeaturesNames = invalidFeatures.map(function(feature) {
                        return feature.name;
                    });
                    self.preventScanReason = undefined;
                    callback({
                        invalids: invalidFeaturesNames
                    });
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
        function getStandardResult(feature) {
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
        featurePrototype.updateStatus = function(callback) {
            var feature = this;

            if (feature.statusIsFrozen) {
                callback(feature);
            } else {
                var settled = false;
                var timeout;
                var settle = function(valid, reason, detail) {
                    if (settled === false) {
                        if (timeout) {
                            clearTimeout(timeout);
                            timeout = null;
                        }
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
                    var branch = this.getTestBranch();
                    if (branch.name === this.when) {
                        var test;
                        if (this.hasOwnProperty('test')) {
                            test = this.test;
                            if (typeof test !== 'function') {
                                throw new TypeError('feature test must be a function');
                            }
                        } else if (this.parent) {
                            test = this.parent.test;
                        } else {
                            throw new Error('feature ' + this + ' has no test method');
                        }

                        var testArgs = [];
                        testArgs.push(branch.value);
                        Iterable.forEach(this.parameters, function(parameter) {
                            testArgs.push(parameter);
                        });
                        testArgs.push(settle);
                        var testSettler = convertToSettler(test);

                        try {
                            testSettler.apply(
                                this,
                                testArgs
                            );

                            var maxDuration = 100;
                            timeout = setTimeout(function() {
                                settle(false, 'timeout', maxDuration);
                            }, maxDuration);
                        } catch (e) {
                            settle(false, 'throwed', e);
                        }
                    } else {
                        settle(false, 'unexpected-' + branch.name, branch.value);
                    }
                }
            }

            return this;
        };
        featurePrototype.when = 'code-runtime-result';
        featurePrototype.getTestBranch = function() {
            var expectedBranchName = this.when;

            var configGetter;
            try {
                configGetter = this.compileConfig();
            } catch (e) {
                return {
                    name: 'config-compilation-error',
                    value: e
                };
            }
            if (!configGetter) {
                throw new Error('feature ' + this + ' has no config method');
            }
            if (expectedBranchName === 'config-compilation-result') {
                return {
                    name: expectedBranchName,
                    value: configGetter
                };
            }

            var configResult;
            try {
                configResult = configGetter.call(this);
            } catch (e) {
                return {
                    name: 'config-runtime-error',
                    value: e
                };
            }
            this.config = configResult;
            if (expectedBranchName === 'config-runtime-result') {
                return {
                    name: expectedBranchName,
                    value: configResult
                };
            }

            var codeGetter;
            try {
                codeGetter = this.compileCode(configResult);
            } catch (e) {
                return {
                    name: 'code-compilation-error',
                    value: e
                };
            }
            if (!codeGetter) {
                throw new Error('feature ' + this + ' has no code method');
            }
            this.code = codeGetter;
            if (expectedBranchName === 'code-compilation-result') {
                return {
                    name: expectedBranchName,
                    value: codeGetter
                };
            }

            var codeResult;
            var codeArgs = Object.keys(configResult).map(function(key) {
                return configResult[key];
            });
            try {
                codeResult = codeGetter.apply(this, codeArgs);
            } catch (e) {
                return {
                    name: 'code-runtime-error',
                    value: e
                };
            }
            this.result = codeResult;
            return {
                name: 'code-runtime-result',
                value: codeResult
            };
        };
        featurePrototype.config = {};
        featurePrototype.compileConfig = function() {
            var configGetter;

            if (this.hasOwnProperty('config')) {
                var ownConfig = this.config;
                var type = typeof ownConfig;
                var ownConfigGetter;

                if (type === 'function') {
                    ownConfigGetter = function() {
                        return ownConfig.call(this);
                    };
                } else if (type === 'object') {
                    ownConfigGetter = function() {
                        return ownConfig;
                    };
                } else if (type === 'string') {
                    var compiledFunction = compileFunction([], ownConfig);
                    ownConfigGetter = function() {
                        return compiledFunction.call(this);
                    };
                } else {
                    throw new TypeError('test.config must be a function, object or string, not ' + type);
                }

                configGetter = function() {
                    var configResult = ownConfigGetter.apply(this, arguments);
                    var parent = this.parent;
                    if (parent) {
                        var inheritedConfigResult = {};
                        jsenv.assign(inheritedConfigResult, parent.config);
                        jsenv.assign(inheritedConfigResult, configResult);
                        configResult = inheritedConfigResult;
                    }
                    return configResult;
                };
            } else if (this.parent) {
                configGetter = function() {
                    return this.parent.config;
                };
            } else {
                configGetter = function() {
                    return this.config;
                };
            }

            return configGetter;
        };
        featurePrototype.compileCode = function(config) {
            var codeGetter;

            if (this.hasOwnProperty('code')) {
                var ownCode = this.code;

                if (typeof ownCode === 'string') {
                    codeGetter = compileFunction(Object.keys(config), ownCode);
                } else if (typeof ownCode === 'function') {
                    codeGetter = ownCode;
                } else {
                    throw new TypeError('feature code must be a string or function');
                }
            } else if (this.parent) {
                codeGetter = this.parent.code;
            } else {
                codeGetter = null;
            }

            return codeGetter;
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
        globalStandard.code = function() {
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
                feature.code = function() {
                    return getStandardResult(this);
                };
                feature.test = presence;
            } else if (typeof test === 'function') {
                feature.test = test;
                feature.code = function() {
                    return parent.result;
                };
                feature.test = test;
            } else if (jsenv.isFeature(test)) {
                var dependency = test;
                feature.relyOn(dependency);
                feature.path = parent.getPath() + '[' + dependency.getPath() + ']';
                feature.code = function() {
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
            if ('code' in descriptor) {
                feature.code = descriptor.code;
            }
            if ('test' in descriptor) {
                feature.test = descriptor.test;
            }
            if ('when' in descriptor) {
                feature.when = descriptor.when;
            }

            implementation.add(feature);
            return feature;
        }

        return {
            registerStandard: standard,
            registerSyntax: registerSyntax
        };
    });
})(jsenv);
