/* eslint-env browser, node */

/*
after including this file you can do
if setup was callback oriented we could even call the installRequirements phase once setup is called and not so early
I will certainly go for this solution

setup().then(function(jsenv) {
    jsenv.config(function() {}); // function executed in serie before jsenv.mainTask
    jsenv.run(function() {}); // function executed in serie after jsenv.mainTask
    jsenv.importMain('./path/to/file.js'); // set jsenv.mainTask to import/execute this file then auto call engine.start
});

concernant les plugins y'aura jsenv.exceptionHandler
et import exceptionHandler from 'jsenv/exceptionHandler';
potentiellement il auront le même effet mais la manière d'ajouter un exceptionHandler sera
import jsenv from 'jsenv';
jsenv.exceptionHandler.add(function() {});

de plus y'aura une option sur setup pour passer une liste des plugins qu'on va utiliser ou pas
genre setup(null) ne mettras aucun plugin
setup({excludes: ['exception-handler']}) will prevent exceptionHandler plugin
setup({includes: ['my custom-plugin']}) could work but the right way to do so is:

setup().then(function(jsenv) {
    jsenv.plugin('./my-custom-plugin');

    return jsenv.importMain();
});

*/

(function() {
    function provideMinimalFeatures(features) {
        // features.provide adds properties to the features object and can be called anywhere
        function provide(data) {
            var properties;

            if (typeof data === 'function') {
                console.log('provide', data.name);
                properties = data.call(features);
            } else {
                properties = data;
            }

            if (properties) {
                for (var key in properties) { // eslint-disable-line
                    features[key] = properties[key];
                }
            }
        }

        features.provide = provide;

        provide(function version() {
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
        });

        provide(function platform() {
            // platform is what runs the agent : windows, linux, mac, ..
            var platform = {
                name: 'unknown',
                version: '',

                setName: function(name) {
                    this.name = name.toLowerCase();
                },

                setVersion: function(version) {
                    this.version = features.createVersion(version);
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

        provide(function agent() {
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
                    this.version = features.createVersion(version);
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
        });

        provide(function globalProvider() {
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

        provide(function baseAndInternalURL() {
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
        });

        provide(function logger() {
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
        });

        provide(function installGlobalMethod() {
            return {
                installGlobalMethod: function(globalName, method) {
                    var globalObject = this.global;
                    var hasPreviousGlobalValue = globalName in globalObject;
                    var previousGlobalValue = globalObject[globalName];

                    globalObject[globalName] = method;

                    // give a way to restore global state
                    return function uninstall() {
                        if (hasPreviousGlobalValue) {
                            globalObject[globalName] = previousGlobalValue;
                        } else {
                            delete globalObject[globalName];
                        }
                    };
                }
            };
        });

        /*
        DEPRECATED (not used anymore)
        provide(function include() {
            var importMethod;

            if (features.isBrowser()) {
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
        */

        return features;
    }

    function listRequirements(features) {
        function hasSetImmediate() {
            return 'setImmediate' in features.global;
        }

        function hasPromise() {
            if (('Promise' in features.global) === false) {
                return false;
            }
            if (Promise.isPolyfill) {
                return true;
            }
            // agent must implement onunhandledrejection to consider promise implementation valid
            if (features.isBrowser()) {
                if ('onunhandledrejection' in features.global) {
                    return true;
                }
                return false;
            } else if (features.isNode()) {
                // node version > 0.12.0 got the unhandledRejection hook
                // this way to detect feature is AWFUL but for now let's do this
                return features.agent.version.major > 0 || features.agent.version.minor > 12;
            }
            return false;
        }

        function hasURL() {
            return 'URL' in features.global;
        }

        var fileToLoad = [];
        if (hasSetImmediate() === false) {
            fileToLoad.push('lib/polyfill/set-immediate/index.js');
        }
        if (hasPromise() === false) {
            fileToLoad.push('lib/polyfill/promise/index.js');
        }
        if (hasURL() === false) {
            fileToLoad.push('lib/polyfill/url/index.js');
        }

        if (features.isBrowser()) {
            fileToLoad.push('node_modules/systemjs/dist/system.js');
        } else {
            fileToLoad.push('node_modules/systemjs/index.js');
        }

        // for now juste polyfill eveyrthing using the babel polyfill
        // ideally we could load only the needed polyfill using jsenv/need but
        // that would be a bunch of work
        if (features.isBrowser()) {
            fileToLoad.push('node_modules/babel-polyfill/dist/polyfill.js');
        } else {
            fileToLoad.push('node_modules/babel-polyfill/lib/index.js');
        }

        fileToLoad = fileToLoad.map(function(filePath) {
            return features.dirname + '/' + filePath;
        });

        return fileToLoad;
    }

    function installRequirements(features, requirements, callback) {
        function includeAllBrowser(urls) {
            var i = 0;
            var j = urls.length;
            var url;
            var loadCount = 0;

            var uninstall = features.installGlobalMethod('includeLoaded', function() {
                loadCount++;
                if (loadCount === j) {
                    uninstall();
                    callback();
                }
            });

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

        function includeAllNode(urls) {
            var i = 0;
            var j = urls.length;
            var url;
            for (;i < j; i++) {
                url = urls[i];
                if (url.indexOf('file:///') === 0) {
                    url = url.slice('file:///'.length);
                }

                features.debug('include', url);
                require(url);
            }
            callback();
        }

        if (features.isBrowser()) {
            includeAllBrowser(requirements);
        } else {
            includeAllNode(requirements);
        }
    }

    // create an object that will receive the features
    var features = {
        name: 'jsenv' // the future module name exporting the features
    };
    // provide the minimal features available : platform, agent, global, baseAndInternalURl
    provideMinimalFeatures(features);
    // list requirements amongst setimmediate, promise, url, url-search-params, system
    var requirements = listRequirements(features);

    installRequirements(features, requirements, function() {
        System.transpiler = 'babel';
        System.babelOptions = {};
        System.paths.babel = features.dirname + '/node_modules/babel-core/browser.js';

        features.provide(function coreModules() {
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
            return {
                registerCoreModule: registerCoreModule
            };
        });

        if (features.isNode()) {
            // @node/fs etc available thanks to https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L1695
            features.registerCoreModule('@node/require', require);
        }

        features.need = {
            'url-search-params': 'URLSearchParams' in features.global === false
        };

        features.registerCoreModule(features.name, features);

        [
            'dependency-graph',
            'iterable',
            'options',
            'proto',
            'thenable',
            'timeout',
            'uri'
        ].forEach(function(utilName) {
            System.paths['jsenv/' + utilName] = features.dirname + '/lib/util/' + utilName + '/index.js';
        });

        /*
        why put a method on the global scope ?
        Considering that in the browser you will put a script tag, you need a pointer on features somewhere
        - we could use System.import('engine') but engine is a wrapper to System so it would be strange
        to access features with something higher level in terms of abstraction
        - we could count on an other global variable but I don't know any reliable global variable for this purpose
        - because it's a "bad practice" to pollute the global scope we provide a renameGlobal() & restorePreviousGlobalValue() to cover
        improbable conflictual scenario
        */

        var uninstall = features.installGlobalMethod('setup', function(options) {
            uninstall();
            features.options = options;

            return System.import('./lib/setup/index.js').then(function() {
                return features;
            });
        });
    });
})();
