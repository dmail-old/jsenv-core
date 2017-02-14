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
})();

/*
Cette seconde partie concerne les features et l'implementation de celle-ci
On s'en sert pour tester comment se comporte l'environnement et pouvoir réagir
en fonction du résultat de ces tests
*/
(function() {
    var Iterable = jsenv.Iterable;
    // var Predicate = jsenv.Predicate;

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

            addDependent: function(dependentFeature, options) {
                dependentFeature.addDependency(this, options);
                return this;
            },

            addDependency: function(dependency, options) {
                if (dependency instanceof VersionnedFeature === false) {
                    throw new Error('addDependency first arg must be a feature (not ' + dependency + ')');
                }
                if (Iterable.includes(this.dependencies, dependency)) {
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

                return this;
            },
            code: undefined,
            pass: function() {
                return true;
            },
            solution: 'none',
            maxTestDuration: 100,
            compile: function() {
                var output;

                if (this.hasOwnProperty('code')) {
                    var code = this.code;

                    if (jsenv.isSourceCode(code)) {
                        output = code.compile();
                    } else if (typeof code === 'function') {
                        output = code.call(this);
                    } else {
                        output = code;
                    }
                } else {
                    output = undefined;
                }

                return output;
            },

            toJSON: function() {
                return {
                    name: this.name,
                    path: this.path,
                    code: this.code,
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
        var noValue = {novalue: true};
        VersionnedFeature.prototype.runPath = function() {
            var feature = this;
            var parent = feature.parent;
            var startValue;
            var output;

            if (parent) {
                startValue = parent.compile();
            } else {
                startValue = jsenv.global;
            }

            if (feature.hasOwnProperty('path')) {
                var path = feature.path;
                var parts = path.split('.');
                var i = 0;
                var j = parts.length;
                while (i < j) {
                    var part = parts[i];
                    if (part in output) {
                        output = output[part];
                    } else {
                        output = noValue;
                        break;
                    }
                    i++;
                }
            } else {
                output = startValue;
            }

            return output;
        };
        VersionnedFeature.prototype.runComposedPath = function() {
            var output;
            var i = 0;
            var composedFeatures = this.dependencies;
            var j = composedFeatures.length;
            while (i < j) {
                var composedFeatureOutput = composedFeatures[i].compile();
                if (i === 0) {
                    output = composedFeatureOutput;
                } else if (composedFeatureOutput in output) {
                    output = output[composedFeatureOutput];
                } else {
                    output = noValue;
                    break;
                }
                i++;
            }
            return output;
        };
        VersionnedFeature.prototype.passPresence = function(output, settle) {
            if (output === noValue) {
                settle(false, 'missing');
            } else {
                settle(true, 'present');
            }
        };
        VersionnedFeature.createIterableObject = function(arr, methods) {
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
        };
        VersionnedFeature.collectKeys = function(value) {
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
        };
        VersionnedFeature.sameValues = function sameValues(a, b) {
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
        };
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
            }
        };

        return {
            implementation: new Implementation()
        };
    });

    jsenv.provide(function registerFeatures() {
        var Iterable = jsenv.Iterable;

        // isProblematic: isInvalid & isEnabled

        function registerFeatures(fn) {
            var features = [];
            var unconflictualFeatures = [];
            fn(registerFeature, jsenv.transpile);

            function registerFeature(name, propertiesConstructor) {
                var feature = createFeature(name);
                var properties = {};
                if (propertiesConstructor) {
                    propertiesConstructor.call(properties, feature);
                }

                var lastSlashIndex = name.lastIndexOf('/');
                if (lastSlashIndex > -1) {
                    var parentName = name.slice(0, lastSlashIndex);
                    feature.addDependency(createFeature(parentName, true), {as: 'parent'});
                }
                if ('dependencies' in properties) {
                    Iterable.forEach(properties.dependencies, function(dependencyName) {
                        feature.addDependency(createFeature(dependencyName, true));
                    });
                }
                if ('parameters' in properties) {
                    Iterable.forEach(properties.parameters, function(parameterName) {
                        feature.addDependency(createFeature(parameterName, true), {as: 'parameter'});
                    });
                }
                checkProperty(feature, properties, 'code');
                checkProperty(feature, properties, 'pass');
                checkProperty(feature, properties, 'fail');
                checkProperty(feature, properties, 'maxTestDuration');
                checkProperty(feature, properties, 'solution');
                checkProperty(feature, properties, 'path');

                return feature;
            }
            function createFeature(name, preventConflict) {
                var feature;
                var existingFeature = jsenv.Iterable.find(features, function(feature) {
                    return feature.match(name);
                });
                if (existingFeature) {
                    if (preventConflict) {
                        feature = existingFeature;
                    } else if (jsenv.Iterable.remove(unconflictualFeatures, existingFeature)) {
                        feature = existingFeature;
                    } else {
                        throw new Error('feature named ' + name + ' already exists');
                    }
                } else {
                    feature = jsenv.createFeature(name);
                    if (preventConflict) {
                        unconflictualFeatures.push(feature);
                    }
                    features.push(feature);
                }

                return feature;
            }
            function checkProperty(feature, properties, propertyName) {
                if (propertyName in properties) {
                    assignProperty(feature, properties[propertyName], propertyName);
                }
            }
            function assignProperty(feature, propertyValue, propertyName) {
                if (propertyValue === 'inherit') {
                    propertyValue = inherit(feature, propertyName);
                } else {
                    feature[propertyName] = propertyValue;
                }
            }
            function inherit(feature, propertyName) {
                var value;
                if ('parent' in feature) {
                    value = feature.parent[propertyName];
                } else {
                    // read from feature prototype
                    // throw new Error('cannot inherit ' + propertyName + ', feature ' + feature.name + ' has no parent');
                }
                return value;
            }

            return features;
        }

        return {
            registerFeatures: registerFeatures
        };
    });

    jsenv.provide(function testFeatures() {
        var Iterable = jsenv.Iterable;

        function testFeatures(features, hooks) {
            var results = [];
            var readyCount = 0;
            var groups = groupNodesByDependencyDepth(features);
            var groupIndex = -1;
            var groupCount = groups.length;
            var done = function() {
                hook('complete', results);
            };
            var hook = jsenv.createHooks({
                hooks: hooks
            });

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
                    var groupReadyCount = 0;
                    var handleResult = function(result) {
                        var feature = this; // callback is async, this is the right feature object we want
                        var featureIndex = features.indexOf(feature);
                        results[featureIndex] = result;
                        readyCount++;

                        var progressEvent = {
                            type: 'progress',
                            target: feature,
                            detail: result,
                            lengthComputable: true,
                            total: features.length,
                            loaded: readyCount
                        };
                        hook('progress', progressEvent);

                        groupReadyCount++;
                        if (groupReadyCount === j) {
                            nextGroup();
                        }
                    };
                    var isInvalid = function(feature) {
                        var featureIndex = features.indexOf(feature);
                        if (featureIndex in results === false) {
                            return false;
                        }
                        var result = results[featureIndex];
                        return result.status === 'invalid';
                    };
                    var dependencyIsInvalid = function(dependency) {
                        return (
                            dependency.isParameterOf(this) === false &&
                            isInvalid(dependency)
                        );
                    };

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
                                hook('crash', e);
                                return;
                            }
                        }
                        i++;
                    }
                }
            }
            nextGroup();
        }

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
            testFeatures: testFeatures
        };
    });

    jsenv.provide(function createHooks() {
        return {
            createHooks: function(options) {
                var hooks = options.hooks || {};
                var fallbackHooks = options.default || {};
                function hook(name, event) {
                    if (name in hooks) {
                        hooks[name](event);
                    } else if (name in fallbackHooks) {
                        fallbackHooks[name](event);
                    }
                }

                return hook;
            }
        };
    });
})();

(function() {
    var implementation = jsenv.implementation;

    function adaptImplementation(how) {
        function run(hooks) {
            var hook = jsenv.createHooks({
                hooks: hooks,
                fallback: {
                    crash: function(event) {
                        throw event.value;
                    }
                }
            });

            function getNextInstruction(instruction) {
                how.writeInstructionOutput(
                    instruction,
                    function(nextInstruction) {
                        return handleNextInstruction(nextInstruction, instruction);
                    }
                );
            }

            var handlers = {
                'scan'(instruction, complete) {
                    var features = eval(instruction.input.features); // eslint-disable-line no-eval

                    jsenv.testFeatures(
                        features,
                        function(results) {
                            complete(results);
                        },
                        function(event) {
                            hook('progress', {
                                step: 'scan-progress',
                                event: event
                            });
                        }
                    );
                },
                'fix'(instruction, complete) {
                    eval(instruction.input.fix); // eslint-disable-line no-eval

                    if ('features' in instruction.input) {
                        var features = eval(instruction.input.features); // eslint-disable-line no-eval
                        jsenv.testFeatures(
                            features,
                            function(report) {
                                complete(report);
                            },
                            function(event) {
                                hook('progress', {
                                    step: 'fixed-scan-progress',
                                    event: event
                                });
                            }
                        );
                    } else {
                        complete();
                    }
                }
            };

            function handleNextInstruction(nextInstruction, instruction) {
                nextInstruction.meta = instruction.meta;

                hook('progress', {
                    step: 'after-' + instruction.name
                });
                if (nextInstruction.name === 'complete') {
                    hook('complete');
                } else if (nextInstruction.name === 'fail') {
                    hook('fail', nextInstruction.input);
                } else if (nextInstruction.name === 'crash') {
                    hook('crash', {
                        value: nextInstruction.input
                    });
                } else {
                    hook('progress', {
                        step: 'before-' + nextInstruction.name
                    });
                    var output = nextInstruction.output;
                    var complete = function(value) {
                        output.status = 'completed';
                        output.value = value;
                        getNextInstruction(nextInstruction);
                    };
                    var fail = function(value) {
                        output.status = 'failed';
                        output.value = value;
                        getNextInstruction(nextInstruction);
                    };
                    var crash = function(value) {
                        output.status = 'crashed';
                        output.value = value;
                        getNextInstruction(nextInstruction);
                    };

                    if (output.status === 'pending') {
                        var method = handlers[nextInstruction.name];
                        var args = [nextInstruction, complete, fail, crash];

                        try {
                            method.apply(handlers, args);
                        } catch (e) {
                            crash(e);
                        }
                    } else {
                        getNextInstruction(nextInstruction);
                    }
                }
            }

            var instruction = {
                name: 'start',
                meta: how.meta,
                input: {},
                output: {
                    status: 'completed',
                    value: undefined
                }
            };

            getNextInstruction(instruction);
        }

        return {
            run: run
        };
    }

    implementation.adapt = adaptImplementation;
})();
