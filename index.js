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
    provide(function version() {
        var anyChar = '*';
        var hiddenChar = '?';

        function VersionPart(value) {
            if (value === anyChar || value === hiddenChar) {
                this.value = value;
            } else if (isNaN(value)) {
                // I dont wanna new Version to throw
                // in the worst case you end with a version like '?.?.?' but not an error
                this.error = new Error('version part must be a number or * (not ' + value + ')');
                this.value = hiddenChar;
            } else {
                this.value = parseInt(value);
            }
        }
        VersionPart.prototype = {
            constructor: VersionPart,
            isAny: function() {
                return this.value === anyChar;
            },

            isHidden: function() {
                return this.value === hiddenChar;
            },

            isPrecise: function() {
                return this.isAny() === false && this.isHidden() === false;
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
            } else if (versionName === hiddenChar) {
                major = new VersionPart(hiddenChar);
                minor = new VersionPart(hiddenChar);
                patch = new VersionPart(hiddenChar);
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
            isPrecise: function() {
                return (
                    this.major.isPrecise() &&
                    this.minor.isPrecise() &&
                    this.patch.isPrecise()
                );
            },

            isTrustable: function() {
                return (
                    this.major.isHidden() === false &&
                    this.minor.isHidden() === false &&
                    this.patch.isHidden() === false
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
                return this.major + '.' + this.minor + '.' + this.patch;
            }
        };

        return {
            createVersion: function(string) {
                return new Version(string);
            }
        };
    });
    provide(function platform() {
        // platform is what runs the agent : windows, linux, mac, ..

        function Platform(name, version) {
            this.name = name.toLowerCase();
            this.version = jsenv.createVersion(version);
        }
        Platform.prototype = {
            constructor: Platform,

            match: function(platform) {
                return (
                    platform === this || (
                        platform.name === this.name &&
                        platform.verison.match(this.verison)
                    )
                );
            }
        };

        return {
            createPlatform: function(name, version) {
                return new Platform(name, version || '?');
            },
            platform: new Platform('unknown', '?'),

            isWindows: function() {
                return this.platform.name === 'windows';
            }
        };
    });
    provide(function agent() {
        // agent is what runs JavaScript : nodejs, iosjs, firefox, ...
        function Agent(type, name, version) {
            this.type = type;
            this.name = name.toLowerCase();
            this.version = jsenv.createVersion(version || '?');
        }
        Agent.prototype = {
            constructor: Agent,

            match: function(agent) {
                return (
                    agent === this || (
                        agent.type === this.type &&
                        agent.name === this.name &&
                        agent.version.match(this.version)
                    )
                );
            }
        };

        return {
            createAgent: function(type, name, version) {
                return new Agent(type, name, version);
            },

            agent: new Agent('unknown', 'unknown', '?'),

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
                platformVersion = '?';
            }
        } else if (typeof process === 'object' && {}.toString.call(process) === "[object process]") {
            agentType = 'node';
            agentName = 'node';
            agentVersion = process.version.slice(1);

            // https://nodejs.org/api/process.html#process_process_platform
            // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
            platformName = process.platform === 'win32' ? 'windows' : process.platform;
            platformVersion = require('os').release();
        } else {
            agentType = 'unknown';
            agentName = 'unknown';
            agentVersion = '?';
            platformName = 'unknown';
            platformVersion = '?';
        }

        var agent = jsenv.createAgent(agentType, agentName, agentVersion);
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

    jsenv.provide(function versionnedFeature() {
        var versionSeparator = '@';
        function VersionnedFeature() {
            this.excluded = false;
            this.dependents = [];
            this.dependencies = [];
            this.parameters = [];

            var arity = arguments.length;
            if (arity === 0) {
                this.setName('');
                this.setVersion('*');
            } else if (arity === 1) {
                this.setName(arguments[0]);
                if (!this.version) {
                    this.setVersion('*');
                }
            } else {
                this.setName(arguments[0]);
                this.setVersion(arguments[1]);
            }
        }
        VersionnedFeature.prototype = {
            constructor: VersionnedFeature,

            setName: function(firstArg) {
                var separatorIndex = firstArg.indexOf(versionSeparator);
                if (separatorIndex === -1) {
                    this.name = firstArg;
                } else {
                    this.name = firstArg.slice(0, separatorIndex);
                    var version = firstArg.slice(separatorIndex + versionSeparator.length);
                    this.setVersion(version);
                }
            },
            setVersion: function(version) {
                this.version = jsenv.createVersion(version);
            },
            toString: function() {
                return this.name + versionSeparator + this.version;
            },
            match: function(other) {
                return (
                    this === other || (
                        this.name === other.name &&
                        this.version.match(other.version)
                    )
                );
            },
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
            updateStatus: function(callback) {
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
                        var exec = feature.exec;

                        if (!exec) {
                            throw new Error('feature ' + this + ' has no exec method');
                        }
                        var throwedValue;
                        var hasThrowed = false;

                        var args = Iterable.map(this.parameters, function(parameter) {
                            return parameter;
                        });
                        args.push(settle);

                        try {
                            exec.apply(
                                feature,
                                args
                            );

                            var execMaxDuration = 100;
                            setTimeout(function() {
                                settle(false, 'timeout', execMaxDuration);
                            }, execMaxDuration);
                        } catch (e) {
                            hasThrowed = true;
                            throwedValue = e;
                        }

                        if (hasThrowed) {
                            settle(false, 'throwed', throwedValue);
                        }
                    }
                }

                return this;
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
                var inclusionHalf = Iterable.bisect(this.features, function(feature) {
                    return feature.isExcluded();
                });
                var excludedFeatures = inclusionHalf[0];
                var includedFeatures = inclusionHalf[1];
                var groups = groupNodesByDependencyDepth(includedFeatures);
                var groupIndex = -1;
                var groupCount = groups.length;
                var done = function() {
                    var validHalf = Iterable.bisect(includedFeatures, function(feature) {
                        return feature.isValid();
                    });
                    var report = {
                        excluded: excludedFeatures,
                        included: includedFeatures,
                        includedAndGroupedByDependencyDepth: groups,
                        includedAndValid: validHalf[0],
                        includedAndInvalid: validHalf[1]
                    };
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

    jsenv.provide(function createStandardFeature() {
        var implementation = jsenv.implementation;
        var noValue = {novalue: true};

        function registerStandard(globalValue) {
            var feature = jsenv.createFeature();

            feature.name = 'global';
            feature.type = 'standard';
            feature.exec = presence;
            feature.value = globalValue;
            feature.ensure = function(descriptor) {
                var dependent = jsenv.createFeature();

                dependent.parent = this;
                dependent.type = this.type;
                dependent.ensure = this.ensure;
                dependent.valueGetter = feature.valueGetter;
                dependent.relyOn(this);

                var descriptorName;
                var descriptorPath;
                var descriptorKind;
                var descriptorTest;
                if ('name' in descriptor) {
                    descriptorName = descriptor.name;
                }
                if ('test' in descriptor) {
                    descriptorTest = descriptor.test;
                }
                if ('kind' in descriptor) {
                    descriptorKind = descriptor.kind;
                }
                if ('path' in descriptor) {
                    descriptorPath = descriptor.path;
                    if (jsenv.isFeature(descriptorPath)) {
                        var dependency = descriptorPath;
                        descriptorPath = this.getPath() + '[' + dependency.getPath() + ']';
                        dependent.relyOn(dependency);
                        if (!descriptorName) {
                            descriptorName = dependency.name;
                        }
                        dependent.valueGetter = function() {
                            var fromValue = this.parent.value;
                            var dependencyValue = dependency.value;

                            if (dependencyValue in fromValue) {
                                return fromValue[dependencyValue];
                            }
                            return noValue;
                        };
                    } else if (typeof descriptorPath === 'string') {
                        if (!descriptorName) {
                            descriptorName = camelToHyphen(descriptorPath);
                        }
                    }
                }

                dependent.name = descriptorName;
                // if (this === feature) {

                // } else {
                //     dependent.name = this.name + '-' + descriptorName;
                // }

                if (descriptorPath) {
                    dependent.path = descriptorPath;
                }

                var tasks = [];
                if (descriptorPath) {
                    tasks.push(presence);
                }
                if (descriptorKind) {
                    tasks.push(ensureKind(descriptorKind));
                }
                if (descriptorTest) {
                    tasks.push(function() {
                        var args = arguments;
                        var arity = args.length;
                        var testArity = descriptorTest.length;

                        if (testArity < arity) {
                            var settle = args[arity - 1];
                            var returnValue = descriptorTest.apply(this, args);
                            settle(Boolean(returnValue), 'returned', returnValue);
                        } else {
                            descriptorTest.apply(this, args);
                        }
                    });
                }
                if (tasks.length > 0) {
                    if (tasks.length === 1) {
                        dependent.exec = tasks[0];
                    } else {
                        dependent.exec = function() {
                            var i = 0;
                            var j = tasks.length;
                            var statusValid;
                            var statusReason;
                            var statusDetail;
                            var handledCount = 0;
                            var args = Array.prototype.slice.call(arguments);
                            var lastArgIndex = args.length - 1;
                            var settle = args[lastArgIndex];

                            function compositeSettle(valid, reason, detail) {
                                handledCount++;

                                statusValid = valid;
                                statusReason = reason;
                                statusDetail = detail;

                                var settled = false;
                                if (statusValid) {
                                    settled = handledCount === j;
                                } else {
                                    settled = true;
                                }

                                if (settled) {
                                    settle(statusValid, statusReason, statusDetail);
                                }
                            }

                            args[lastArgIndex] = compositeSettle;

                            while (i < j) {
                                tasks[i].apply(this, args);
                                if (statusValid === false) {
                                    break;
                                }
                                i++;
                            }
                        };
                    }
                }

                implementation.add(dependent);
                return dependent;
            };

            function camelToHyphen(string) {
                var i = 0;
                var j = string.length;
                var camelizedResult = '';
                while (i < j) {
                    var letter = string[i];
                    var action;

                    if (i === 0) {
                        action = 'lower';
                    } else if (isUpperCaseLetter(letter)) {
                        if (isUpperCaseLetter(string[i - 1])) { // toISOString -> to-iso-string & toJSON -> to-json
                            if (i === j - 1) { // toJSON on the N
                                action = 'lower';
                            } else if (isLowerCaseLetter(string[i + 1])) { // toISOString on the S
                                action = 'camelize';
                            } else { // toJSON on the SO
                                action = 'lower';
                            }
                        } else if (
                            isLowerCaseLetter(string[i - 1]) &&
                            i > 1 &&
                            isUpperCaseLetter(string[i - 2])
                        ) { // isNaN -> is-nan
                            action = 'lower';
                        } else {
                            action = 'camelize';
                        }
                    } else {
                        action = 'concat';
                    }

                    if (action === 'lower') {
                        camelizedResult += letter.toLowerCase();
                    } else if (action === 'camelize') {
                        camelizedResult += '-' + letter.toLowerCase();
                    } else if (action === 'concat') {
                        camelizedResult += letter;
                    } else {
                        throw new Error('unknown camelize action');
                    }

                    i++;
                }
                return camelizedResult;
            }
            function isUpperCaseLetter(letter) {
                return /[A-Z]/.test(letter);
            }
            function isLowerCaseLetter(letter) {
                return /[a-z]/.test(letter);
            }

            feature.valueGetter = function() {
                var endValue;

                if (this === feature) {
                    endValue = globalValue;
                } else {
                    var path = this.path;
                    var parts = path.split('.');
                    var startValue = this.parent.value;
                    endValue = startValue;
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
                }

                return endValue;
            };
            function presence(settle) {
                var value = this.valueGetter();
                if (value === noValue) {
                    settle(false, 'missing');
                } else {
                    this.value = value;
                    settle(true, 'present', value);
                }
            }
            function ensureKind(expectedKind) {
                return function(settle) {
                    var value = this.value;
                    var actualKind;

                    if (expectedKind === 'object' && value === null) {
                        actualKind = 'null';
                    } else if (expectedKind === 'symbol') {
                        if (value && value.constructor === Symbol) {
                            actualKind = 'symbol';
                        } else {
                            actualKind = typeof value;
                        }
                    } else {
                        actualKind = typeof value;
                    }

                    if (actualKind === expectedKind) {
                        settle(true, 'expected-' + actualKind, value);
                    } else {
                        settle(false, 'unexpected-' + actualKind, value);
                    }
                };
            }
            implementation.add(feature);
            return feature;
        }

        var globalStandard = registerStandard(jsenv.global);

        function standard(name, test) {
            var parentStandard = globalStandard;
            var parts = name.split('-');
            var i = parts.length;
            if (i > 1) {
                while (i > 1) {
                    var possibleParentName = parts.slice(0, i - 1).join('-');
                    var possibleParent = implementation.find(jsenv.createFeature(possibleParentName));
                    if (possibleParent) {
                        parentStandard = possibleParent;
                        break;
                    }
                    i--;
                }
            }

            var descriptor = {};

            descriptor.name = name;
            if (typeof test === 'string' || typeof test === 'object') {
                descriptor.path = test;
            } else if (typeof test === 'function') {
                descriptor.test = test;
            }

            return parentStandard.ensure(descriptor);
        }

        return {
            createStandardFeature: standard
        };
    });

    jsenv.provide(function createSyntaxFeature() {
        var implementation = jsenv.implementation;

        function assert(firstArg, codeReturnValueTest) {
            var code;
            if (typeof firstArg === 'function') {
                code = firstArg.toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
            } else if (typeof firstArg === 'string') {
                code = firstArg;
            } else {
                throw new TypeError('assert first argument must be a string or a function');
            }

            return function(settle) {
                var returnValue = eval(code); // eslint-disable-line

                if (codeReturnValueTest) {
                    if (codeReturnValueTest.length < 2) {
                        returnValue = codeReturnValueTest.call(this, returnValue);
                        settle(Boolean(returnValue), 'returned', returnValue);
                    } else {
                        codeReturnValueTest.call(this, returnValue, settle);
                    }
                } else {
                    settle(Boolean(returnValue), 'returned', returnValue);
                }
            };
        }
        function registerSyntax(syntaxDescriptor) {
            var feature = jsenv.createFeature();

            feature.name = syntaxDescriptor.name;
            feature.type = 'syntax';
            feature.exec = syntaxDescriptor.test;
            feature.ensure = function(syntaxDescriptor) {
                var dependent = jsenv.createFeature();

                dependent.relyOn(this);
                dependent.parent = this;
                dependent.type = this.type;

                if ('name' in syntaxDescriptor) {
                    dependent.name = syntaxDescriptor.name;
                }
                if ('dependencies' in syntaxDescriptor) {
                    var dependencies = Iterable.map(syntaxDescriptor.dependencies, function(dependencyName) { // eslint-disable-line
                        return implementation.get(dependencyName);
                    });
                    dependent.relyOn.apply(dependent, dependencies);
                }
                if ('parameters' in syntaxDescriptor) {
                    var parameters = Iterable.map(syntaxDescriptor.parameters, function(parameterName) { // eslint-disable-line
                        return implementation.get(parameterName);
                    });
                    dependent.parameterizedBy.apply(dependent, parameters);
                }
                if ('test' in syntaxDescriptor) {
                    dependent.exec = syntaxDescriptor.test;
                }

                implementation.add(dependent);
                return dependent;
            };
            implementation.add(feature);
            return feature;
        }
        function syntax(name, descriptor) {
            var parent = null;
            var parts = name.split('-');
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

            descriptor.name = name;

            if (parent) {
                return parent.ensure(descriptor);
            }
            return registerSyntax(descriptor);
        }

        return {
            createSyntaxFeature: syntax,
            assertSyntax: assert
        };
    });

    jsenv.provide(function registerStandardFeatures() {
        var standard = jsenv.createStandardFeature;

        standard('system', 'System');
        standard('promise', 'Promise');
        standard('promise-unhandled-rejection', function(settle) {
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
        standard('promise-rejection-handled', function(settle) {
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
        /*
        if (jsenv.isBrowser() === false) {
            implementation.exclude('node-list');
            // etc
            // en gros on exclu certains features quand on est pas dans le browser
        }
        */
    });

    jsenv.provide(function registerSyntaxFeatures() {
        var syntax = jsenv.createSyntaxFeature;
        var assert = jsenv.assertSyntax;

        syntax('const', {
            test: assert(
                'const foo = 123; foo;',
                function(foo) {
                    return foo === 123;
                }
            )
        });
        syntax('const-is-block-scoped', {
            test: assert(
                'const bar = 123; { const bar = 456; }; bar;',
                function(bar) {
                    return bar === 123;
                }
            )
        });
        syntax('for-of', {

        }).exclude();
        syntax('const-scoped-for-of', {
            dependencies: ['for-of'],
            test: assert(
                function() {/*
                    var scopes = [];
                    for(const i of ['a','b']) {
                      scopes.push(function(){ return i; });
                    }
                    scopes;
                */},
                function(scopes) {
                    return (
                        scopes[0]() === "a" &&
                        scopes[1]() === "b"
                    );
                }
            )
        });
    });
})(jsenv);
