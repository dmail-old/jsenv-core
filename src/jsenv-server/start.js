/* eslint-disable no-path-concat */

/*
- continuer sur l'import de server.js

- faire en sorte que même avant de démarrer le serveur on est du code qui se comporte comme son propre client
vis-a-vis du comportement qu'aura le client plus tard
1 : lorsqu'on le requête, si le client qui le demande est inconnu au bataillon
alors il lui dit hey client veut tu bien lancer ces tests pour que je sache si on est compatible ?
ensuite le client lui donne le résultats des tests
le serveur répond alors avec un polyfill.js que le client doit éxécuter
le client doit aussi rerun les tests pour vérifier que polyfill.js fonctionne bien
    si tout se passe bien alors le client envoit une requête au serveur
    pour lui dire hey mec nickel chrome merci
    là le serveur stocke cette info pour savoir que pour ce type de client tout va bien

    si ça ne se passe pas bien le client affiche une erreur et envoie au serveur
    mec ça marche ton truc
    le serveur stocke cette info pour savoir que pour ce type de client y'a un souci

- quand et comment le client lance-t-il une première requête de compatibilité avec les features requises ?
-> au chargement de la page, avant toute chose et à chaque fois on demande au serveur si on est compatiblez
- sous quel format dit-on au client: voici les tests que tu dois lancer ?
-> 200 + une sorte de json contenant tous les tests serais top, le prob étant que ce n'est pas leur forme actuelle
autre souci du JSON: les fonctions devraient être eval, un peu relou
le plus simple serait donc de renvoyer un js
- sous quel format dit-on au client: c'est mort tu n'est pas polyfillable ?
-> on lui renvoit un code d'erreur genre pas 200 avec un message associé
- sous quel format dit-on au client: voici le polyfill que tu dois éxécuter, pas besoin de test ?
-> 200 + le pollyfill en tant que fichier js qu'on éxécute sans se poser de question

- le cache de polyfill.js & features-after-flatten.js
dépend de la liste des features requises (non disabled) et doit donc être invalidé
lorsque cette liste est modifiée

- TOUT sauf "implementation-report-before-flatten.json"" dépend de la liste des solutions disponsibles
lorsque on ajoute/enlève/met à jour des solutions le cache de ces fichiers doit aussi être invalidé

- changer memoize.file pour une écriture comme suit:
memoize.file(fn, path, {
    sources: [
        {path: , strategy: 'mtime'},
        {path: , strategy: 'eTag'},
    ],
    mode: 'default'
    // pour voir comment le cache http fonctionne (pas utile pour le moment)
    https://fetch.spec.whatwg.org/#requests
    // default : peut écrire et lire depuis le cache (cas par défaut)
    // read-only : peut lire depuis le cache, n'écrira pas dedans (pour travis)
    // write-only : ne peut pas lire depuis le cache, écrira dedans (inutile)
    // only-if-cached: peut lire et throw si le cache est invalide au lieu d'apeller la fonction (inutile mais pourra le devenir un jour)
})

- externaliser sourcemap au lie de inline base64, enfin faire une option
cela signifie que pour que le cache soit valide il faudra aussi check l'existance de son fichier sourcemap
ou alors toruver une autre soluce

- yield, async, generator, prévoir les features/plugins/polyfill correspondant

- race condition writefile ?
si oui faudrais une queue de write pour s'assurer que la dernière version est bien celle
qui est finalement écrit

- more : npm install dynamique

*/

require('../jsenv.js');
var rootFolder = '../..';
var cacheFolder = rootFolder + '/cache';
var jsenv = global.jsenv;
var Iterable = jsenv.Iterable;
var implementation = jsenv.implementation;
var memoize = require('./memoize.js');
var fsAsync = require('./fs-async.js');
var getFileStore = require('./fs-store.js');

var options = {
    cache: true
};

// renommer fix/solution/solver/solve
var createTask = (function() {
    function Task(name, descriptor) {
        this.name = name;
        jsenv.assign(this, descriptor);
    }

    Task.prototype = {
        constructor: Task,
        required: 'auto',
        features: [],
        afterScanHook: function(features) {
            if (this.required !== false) {
                this.features = Iterable.map(this.features, function(featureName) {
                    var foundFeature = Iterable.find(features, function(feature) {
                        return feature.match(featureName);
                    });
                    if (!foundFeature) {
                        throw new Error('cannot find feature named ' + featureName + ' for task ' + this.name);
                    }
                    return foundFeature;
                }, this);
            }

            if (this.required === 'auto') {
                var someFeatureIsProblematic = Iterable.some(this.features, function(feature) {
                    return feature.isInvalid();
                });
                this.required = someFeatureIsProblematic;
            }

            if (this.required) {
                Iterable.forEach(this.features, function(feature) {
                    feature.status = 'unspecified';
                    this.beforeInstallFeatureEffect(feature);
                }, this);
            }
        },
        beforeInstallFeatureEffect: function() {

        },
        beforeInstallHook: function() {

        },
        afterInstallHook: function() {
            Iterable.forEach(this.features, function(feature) {
                feature.status = 'unspecified';
                this.afterInstallFeatureEffect(feature);
            }, this);
        },
        afterInstallFeatureEffect: function() {

        }
    };

    return function() {
        return jsenv.construct(Task, arguments);
    };
})();

var coreJSTasks = [];
function coreJSModule(name, descriptor) {
    var task = createTask(name, descriptor);
    task.type = 'polyfill';

    task.beforeInstallFeatureEffect = function(feature) {
        feature.statusReason = 'polyfilling';
        feature.statusDetail = 'corejs:' + this.name;
    };
    task.afterInstallFeatureEffect = function(feature) {
        feature.statusReason = 'polyfilled';
        feature.statusDetail = 'corejs:' + this.name;
    };

    coreJSTasks.push(task);
    return task;
}
coreJSModule('es6.promise', {
    required: 'auto',
    features: [
        'promise',
        'promise-unhandled-rejection',
        'promise-rejection-handled'
    ]
});
coreJSModule('es6.symbol', {
    features: [
        'symbol',
        'symbol-to-primitive'
    ]
});
coreJSModule('es6.object.get-own-property-descriptor', {
    features: [
        'object-get-own-property-descriptor'
    ]
});
coreJSModule('es6.date.now', {
    features: [
        'date-now'
    ]
});
coreJSModule('es6.date.to-iso-string', {
    features: [
        'date-prototype-to-iso-string',
        'date-prototype-to-iso-string-negative-5e13',
        'date-prototype-to-iso-string-nan-throw'
    ]
});
coreJSModule('es6.date.to-json', {
    features: [
        'date-prototype-to-json',
        'date-prototype-to-json-nan-return-null',
        'date-prototype-to-json-use-to-iso-string'
    ]
});
coreJSModule('es6.date.to-primitive', {
    features: [
        'date-prototype-symbol-to-primitive'
    ]
});
coreJSModule('es6.date-to-string', {
    features: [
        'date-prototype-to-string-nan-return-invalid-date'
    ]
});
coreJSModule('es6.function.name', {
    features: [
        'function-prototype-name'
    ]
});
// coreJSModule('es6.function.bind', {
//     features: [
//         'function-prototype-bind',
//     ]
// });
coreJSModule('es6.object.assign', {
    features: [
        'object-assign'
    ]
});
coreJSModule('es6.array.iterator', {
    features: [
        'array-prototype-symbol-iterator',
        'array-prototype-symbol-iterator-sparse'
    ]
});
coreJSModule('es6.array.from', {
    features: [
        'array-from'
    ]
});
coreJSModule('es6.string.iterator', {
    features: [
        'string-prototype-symbol-iterator',
        'string-prototype-symbol-iterator-basic',
        'string-prototype-symbol-iterator-astral'
    ]
});

var fileTasks = [];
function file(name, descriptor) {
    if (name[0] === '.' && name[1] === '/') {
        name = rootFolder + name.slice(1);
    }

    var task = createTask(name, descriptor);
    task.type = 'polyfill';

    task.beforeInstallFeatureEffect = function(feature) {
        feature.statusReason = 'polyfilling';
        feature.statusDetail = 'file:' + this.name;
    };
    task.afterInstallFeatureEffect = function(feature) {
        feature.statusReason = 'polyfilled';
        feature.statusDetail = 'file:' + this.name;
    };

    fileTasks.push(task);
    return task;
}
file('./node_modules/systemjs/dist/system.src.js', {
    required: true,
    features: [
        'system'
    ]
});
file('./src/polyfill/url/index.js', {
    features: [
        'url'
    ]
});
file('./src/polyfill/url-search-params/index.js', {
    features: [
        'url-search-params'
    ]
});

var babelTasks = [];
function babelPlugin(name, descriptor) {
    var task = createTask(name, descriptor);
    task.type = 'transpile';

    task.beforeInstallFeatureEffect = function(feature) {
        feature.statusIsFrozen = true;
        feature.statusReason = 'transpiling';
        feature.statusDetail = 'babel:' + this.name;
    };
    task.afterInstallFeatureEffect = function(feature) {
        feature.statusIsFrozen = true;
        feature.statusReason = 'transpiled';
        feature.statusDetail = 'babel:' + this.name;
    };

    babelTasks.push(task);
    return task;
}
babelPlugin('transform-es2015-function-name', {
    required: 'auto',
    features: [
        'function-prototype-name-statement',
        'function-prototype-name-expression',
        'function-prototype-name-var',
        'function-prototype-name-method-shorthand',
        'function-prototype-name-method-shorthand-lexical-binding'
    ]
});
babelPlugin('transform-regenerator', {
    required: false, // on désactive pour le moment, j'ai pas fait les feature correspondantes
    config: {
        generators: 'auto',
        async: 'auto',
        asyncGenerators: 'auto'
    },
    features: [
        'function-generator'
    ],
    afterScanHook: function(features) {
        Object.getPrototypeOf(this).afterScanHook.apply(this, arguments);

        if (this.required) {
            file({
                name: './node_modules/regenerator/dist/regenerator.js',
                required: true
            });

            var featureIsProblematic = function() {
                return Iterable.some(features, function(feature) {
                    return feature.match(feature) && feature.isInvalid();
                });
            };

            var config = this.config;
            if (config.generators === 'auto') {
                config.generators = featureIsProblematic('function-generator');
            }
            if (config.async === 'auto') {
                config.async = featureIsProblematic('function-async');
            }
            if (config.asyncGenerators === 'auto') {
                config.asyncGenerators = featureIsProblematic('function-generator-async');
            }
        }
    }
});
babelPlugin('transform-es2015-block-scoping', {
    required: 'auto',
    features: [
        'const',
        'const-temporal-dead-zone',
        'const-scoped',
        'const-scoped-for-statement',
        'const-scoped-for-body',
        'const-scoped-for-of-body',
        'let',
        'let-throw-statement',
        'let-temporal-dead-zone',
        'let-scoped',
        'let-scoped-for-statement',
        'let-scoped-for-body'
    ]
});
babelPlugin('transform-es2015-computed-properties', {
    required: 'auto',
    features: [
        'computed-properties'
    ]
});
babelPlugin('transform-es2015-for-of', {
    required: 'auto',
    features: [
        'for-of',
        'for-of-iterable',
        'for-of-iterable-instance',
        'for-of-iterable-return-called-on-break',
        'for-of-iterable-return-called-on-throw'
    ]
});
babelPlugin('transform-es2015-parameters', {
    required: 'auto',
    features: [
        'function-default-parameters',
        'function-default-parameters-explicit-undefined',
        'function-default-parameters-refer-previous',
        'function-default-parameters-arguments',

        'function-rest-parameters',
        'function-rest-parameters-throw-setter',
        'function-rest-parameters-length'
    ]
});
babelPlugin('transform-es2015-shorthand-properties', {
    required: 'auto',
    features: [
        'shorthand-properties',
        'shorthand-methods'
    ]
});
babelPlugin('transform-es2015-spread', {
    required: 'auto',
    features: [
        'spread-function-call',
        'spread-function-call-iterable',
        'spread-function-call-iterable-instance',
        'spread-literal-array',
        'spread-literal-array-iterable',
        'spread-literal-array-iterable-instance'
    ]
});
babelPlugin('transform-es2015-destructuring', {
    features: [
        'destructuring-declaration-array',
        'destructuring-declaration-array-trailing-commas',
        'destructuring-declaration-array-iterable',
        'destructuring-declaration-array-iterable-instance',
        'destructuring-declaration-array-sparse',
        'destructuring-declaration-array-nested',
        'destructuring-declaration-array-for-in-statement',
        'destructuring-declaration-array-for-of-statement',
        'destructuring-declaration-array-catch-statement',
        'destructuring-declaration-array-rest',
        'destructuring-declaration-array-default',

        'destructuring-declaration-object',
        'destructuring-declaration-object-throw-null',
        'destructuring-declaration-object-throw-undefined',
        'destructuring-declaration-object-primitive-return-prototype',
        'destructuring-declaration-object-trailing-commas',
        'destructuring-declaration-object-double-dot-as',
        'destructuring-declaration-object-computed-properties',
        'destructuring-declaration-object-catch-statement',
        'destructuring-declaration-object-default',
        'destructuring-declaration-object-default-let-temporal-dead-zone',

        'destructuring-declaration-array-chain-object',
        'destructuring-declaration-array-nest-object',
        'destructuring-declaration-object-nest-array',

        'destructuring-assignment-array',
        'destructuring-assignment-array-empty',
        'destructuring-assignment-array-rest-nest',
        'destructuring-assignment-array-expression-return',
        'destructuring-assignment-array-chain',

        'destructuring-assignment-object',
        'destructuring-assignment-object-empty',
        'destructuring-assignment-object-expression-return',
        'destructuring-assignment-object-throw-left-parenthesis',
        'destructuring-assignment-object-chain',

        'destructuring-parameters-array',
        'destructuring-parameters-array-function-length',

        'destructuring-parameters-object',
        'destructuring-parameters-object-function-length'
    ]
});
babelPlugin('check-es2015-constants', {
    required: true
});

function getBeforeFlattenStoreEntry(meta) {
    var path = cacheFolder + '/before-flatten';
    var match = function(entryMeta, meta) {
        return entryMeta.userAgent === meta.userAgent;
    };

    return getFileStore(path, match).then(function(store) {
        return store.match(meta);
    });
}
function getPolyfillStoreEntry(meta) {
    var path = cacheFolder + '/polyfill';
    var match = function(entryMeta, meta) {
        return (
            entryMeta.coreJs.sort().join() === meta.coreJS.sort().join() &&
            entryMeta.files.sort().join() === meta.files.sort().join()
        );
    };
    return getFileStore(path, match).then(function(store) {
        return store.match(meta);
    });
}
function getTranspileStoreEntry(meta) {
    var path = cacheFolder + '/transpile';
    var match = function(entryMeta, meta) {
        return entryMeta.plugins.sort().join() === meta.plugins.sort().join();
    };
    return getFileStore(path, match).then(function(store) {
        return store.match(meta);
    });
}
function getAfterFlattenStoreEntry(meta) {
    var path = cacheFolder + '/after-flatten';
    var match = function(entryMeta, meta) {
        return entryMeta.features.sort().join() === meta.features.sort().join();
    };

    return getFileStore(path, match).then(function(store) {
        return store.match(meta);
    });
}

function findFeatureTask(feature) {
    var tasks = coreJSTasks.concat(fileTasks, babelTasks);
    return Iterable.find(tasks, function(task) {
        return Iterable.find(task.features, function(taskFeature) {
            return taskFeature.match(feature);
        });
    });
}

function start() {
    System.trace = true;
    System.meta['*.json'] = {format: 'json'};
    System.config({
        map: {
            '@jsenv/compose': jsenv.dirname + '/node_modules/jsenv-compose'
        },
        packages: {
            '@jsenv/compose': {
                main: 'index.js',
                format: 'es6'
            }
        }
    });

    function createModuleExportingDefault(defaultExportsValue) {
        return this.System.newModule({
            "default": defaultExportsValue // eslint-disable-line quote-props
        });
    }
    function registerCoreModule(moduleName, defaultExport) {
        System.set(moduleName, createModuleExportingDefault(defaultExport));
    }
    function prefixModule(name) {
        var prefix = jsenv.modulePrefix;
        var prefixedName;
        if (prefix) {
            prefixedName = prefix + '/' + name;
        } else {
            prefixedName = name;
        }

        return prefixedName;
    }

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
        var libPath = jsenv.dirname + '/src/' + libName + '/index.js';
        System.paths[prefixModule(libName)] = libPath;
    }, this);

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

    registerCoreModule(prefixModule(jsenv.rootModuleName), jsenv);
    registerCoreModule(prefixModule(jsenv.moduleName), jsenv);
    registerCoreModule('@node/require', require);
    return System.import(jsenv.dirname + '/setup.js').then(function(exports) {
        return exports.default(jsenv);
    }).then(function() {
        return System.import(jsenv.dirname + '/src/jsenv-server/serve.js');
    });
}
function flattenImplementation(options) {
    var polyfiller;
    var transpiler;
    var featuresPath = rootFolder + '/features/features.js';

    function getBeforeFlattenFeatures() {
        var createFeatures = function() {
            return fsAsync.getFileContent(featuresPath).then(function(code) {
                var babel = require('babel-core');
                var result = babel.transform(code, {
                    plugins: [
                        'transform-es2015-template-literals'
                    ]
                });
                return result.code;
            });
        };

        if (options.cache) {
            createFeatures = memoize.file(
                createFeatures,
                cacheFolder + '/features.transpiled.js',
                featuresPath,
                'mtime'
            );
        }

        return createFeatures();
    }
    function scanImplementation() {
        return getBeforeFlattenReport(options).then(
            reviveReport
        ).then(function(beforeReport) {
            var features = beforeReport.features;
            callEveryHook('afterScanHook', features);
            var unhandledProblematicFeatures = features.filter(function(feature) {
                return feature.isEnabled() && feature.isInvalid();
            });
            if (unhandledProblematicFeatures.length) {
                throw new Error('environement miss unfixable features ' + unhandledProblematicFeatures.join(','));
            }
        });
    }
    function getBeforeFlattenReport(options) {
        var createReport = scan;

        if (options.cache) {
            return getBeforeFlattenStoreEntry({
                userAgent: jsenv.userAgent
            }).then(function(usrAgentEntry) {
                return memoize.file(
                    createReport,
                    usrAgentEntry.path + '/report-before-flatten.json',
                    rootFolder + '/features/features.js',
                    'eTag'
                )();
            });
        }

        return createReport();
    }
    function scan() {
        console.log('scanning implementation');
        return new Promise(function(resolve) {
            implementation.scan(resolve);
        });
    }
    function reviveReport(report) {
        [
            'const-throw-statement',
            'const-throw-redefine',
            'function-prototype-name-new',
            'function-prototype-name-accessor',
            'function-prototype-name-method',
            'function-prototype-name-method-computed-symbol',
            'function-prototype-name-bind', // corejs & babel fail this
            'function-default-parameters-temporal-dead-zone',
            'function-default-parameters-scope-own',
            'function-default-parameters-new-function',
            'function-rest-parameters-arguments',
            'function-rest-parameters-new-function',
            'spread-function-call-throw-non-iterable',
            'destructuring-assignment-object-throw-left-parenthesis',
            'destructuring-parameters-array-new-function',
            'destructuring-parameters-object-new-function'
        ].forEach(function(featureName) {
            implementation.disable(featureName, 'babel do not provide this');
        });
        implementation.disable('function-prototype-name-description', 'cannot be polyfilled');

        var invalidFeatureNames = report.invalids;
        var features = Iterable.map(implementation.features, function(feature) {
            var featureCopy = jsenv.createFeature(feature.name, feature.version);
            var featureIsInvalid = Iterable.find(invalidFeatureNames, function(invalidFeatureName) {
                return feature.match(invalidFeatureName);
            });
            if (featureIsInvalid) {
                featureCopy.status = 'invalid';
            } else {
                featureCopy.status = 'valid';
            }
            featureCopy.enabled = feature.enabled;
            return featureCopy;
        });

        return {
            features: features
        };
    }
    function callEveryHook(hookName) {
        var args = Array.prototype.slice.call(arguments, 1);
        callEveryTaskHook.apply(null, [coreJSTasks, hookName].concat(args));
        callEveryTaskHook.apply(null, [fileTasks, hookName].concat(args));
        callEveryTaskHook.apply(null, [babelTasks, hookName].concat(args));
    }
    function callEveryTaskHook(tasks, hookName) {
        var args = Array.prototype.slice.call(arguments, 2);
        Iterable.forEach(tasks, function(task) {
            task[hookName].apply(task, args);
        });
    }
    function fixImplementation() {
        return Promise.all([
            getPolyfiller(options).then(function(value) {
                callEveryTaskHook(coreJSTasks, 'beforeInstallHook');
                callEveryTaskHook(fileTasks, 'beforeInstallHook');
                polyfiller = value;
            }),
            getTranspiler(options).then(function(value) {
                callEveryTaskHook(babelTasks, 'beforeInstallHook');
                transpiler = value;
            })
        ]).then(function() {
            return installPolyfiller(options);
        }).then(function() {
            return installTranspiler(options);
        });
    }
    function getPolyfiller() {
        var requiredModules = coreJSTasks.filter(function(module) {
            return module.required;
        });
        var requiredModuleNames = requiredModules.map(function(module) {
            return module.name;
        });
        var requiredFiles = Iterable.filter(fileTasks, function(file) {
            return file.required;
        });
        var requiredFilePaths = Iterable.map(requiredFiles, function(file) {
            return file.name;
        });

        var createPolyfill = function() {
            function createCoreJSPolyfill() {
                var requiredModulesAsOption = requiredModuleNames;
                console.log('concat corejs modules', requiredModuleNames);

                return new Promise(function(resolve) {
                    var buildCoreJS = require('core-js-builder');
                    var promise = buildCoreJS({
                        modules: requiredModulesAsOption,
                        librabry: false,
                        umd: true
                    });
                    resolve(promise);
                });
            }
            function createOwnFilePolyfill() {
                console.log('concat files', requiredFilePaths);

                var fs = require('fs');
                var sourcesPromises = Iterable.map(requiredFilePaths, function(filePath) {
                    return new Promise(function(resolve, reject) {
                        fs.readFile(filePath, function(error, buffer) {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(buffer.toString());
                            }
                        });
                    });
                });
                return Promise.all(sourcesPromises).then(function(sources) {
                    return sources.join('\n\n');
                });
            }

            return Promise.all([
                createCoreJSPolyfill(),
                createOwnFilePolyfill()
            ]).then(function(sources) {
                return sources.join('\n\n');
            });
        };

        if (options.cache) {
            return Promise.resolve().then(function() {
                return getPolyfillStoreEntry({
                    coreJs: requiredModuleNames,
                    files: requiredFilePaths
                });
            }).then(function(polyfillEntry) {
                return memoize.file(
                    createPolyfill,
                    polyfillEntry.path + '/polyfill.js',
                    requiredFilePaths,
                    'mtime'
                )();
            }).then(function(polyfill) {
                return {
                    code: polyfill
                };
            });
        }

        return createPolyfill().then(function(polyfill) {
            return {
                code: polyfill
            };
        });
    }
    function getTranspiler() {
        var requiredPlugins = babelTasks.filter(function(plugin) {
            return plugin.required;
        });
        var pluginsAsOptions = requiredPlugins.map(function(requiredPlugin) {
            return [requiredPlugin.name, requiredPlugin.options];
        });
        console.log('required babel plugins', requiredPlugins.map(function(plugin) {
            return plugin.name;
        }));

        var transpile = function(code, filename, transpilationOptions) {
            var transpileCode = function(sourceURL) {
                transpilationOptions = transpilationOptions || {};

                var plugins;
                if (transpilationOptions.as === 'module') {
                    plugins = pluginsAsOptions.slice();
                    plugins.unshift('transform-es2015-modules-systemjs');
                } else {
                    plugins = pluginsAsOptions;
                }

                // https://babeljs.io/docs/core-packages/#options
                // inputSourceMap: null,
                // minified: false

                var babelOptions = {};
                babelOptions.plugins = plugins;
                babelOptions.ast = false;
                if ('sourceMaps' in transpilationOptions) {
                    babelOptions.sourceMaps = transpilationOptions.sourceMaps;
                } else {
                    babelOptions.sourceMaps = 'inline';
                }

                var babel = require('babel-core');
                var result = babel.transform(code, babelOptions);
                var transpiledCode = result.code;
                transpiledCode += '\n//# sourceURL=' + sourceURL;
                return transpiledCode;
            };

            if (options.cache) {
                var nodeFilePath;
                if (filename.indexOf('file:///') === 0) {
                    nodeFilePath = filename.slice('file:///'.length);
                } else {
                    nodeFilePath = filename;
                }

                if (nodeFilePath.indexOf(rootFolder) === 0) {
                    var relativeFilePath = nodeFilePath.slice(rootFolder.length);

                    return getTranspileStoreEntry({
                        plugins: pluginsAsOptions
                    }).then(function(entry) {
                        var storePath = entry.path + '/modules/' + relativeFilePath;

                        return memoize.file(
                            transpileCode,
                            storePath,
                            nodeFilePath,
                            'mtime'
                        )(storePath);
                    });
                }
            }

            return transpileCode(filename + '!transpiled');
        };

        var transpiler = {
            plugins: pluginsAsOptions,
            transpile: transpile
        };

        return Promise.resolve(transpiler);
    }
    function installPolyfiller() {
        if (polyfiller.code) {
            eval(polyfiller.code); // eslint-disable-line
        }
        callEveryTaskHook(coreJSTasks, 'afterInstallHook');
        callEveryTaskHook(fileTasks, 'afterInstallHook');
    }
    function installTranspiler() {
        jsenv.global.System.translate = function(load) {
            var code = load.source;
            var filename = load.address;
            load.metadata.format = 'register';

            return transpiler.transpile(code, filename, {
                as: 'module'
            });
        };
        callEveryTaskHook(babelTasks, 'afterInstallHook');
    }
    function customPlugin(babel) {
        // inspired from babel-transform-template-literals
        // https://github.com/babel/babel/blob/master/packages/babel-plugin-transform-es2015-template-literals/src/index.js#L36
        var t = babel.types;

        function transpileTemplate(strings) {
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

            try {
                return transpiler.transpile(result, {
                    as: 'code'
                });
            } catch (e) {
                // if there is an error
                // let test a chance to eval untranspiled string
                // and catch error it may be a test which is trying
                // to ensure compilation error (syntax error for example)
                return result;
            }
        }

        function visitTaggedTemplateExpression(path, state) {
            var TAG_NAME = state.opts.tag || 'transpile';
            var node = path.node;
            if (!t.isIdentifier(node.tag, {name: TAG_NAME})) {
                return;
            }
            var quasi = node.quasi;
            var quasis = quasi.quasis;
            var expressions = quasi.expressions;

            var values = expressions.map(function(expression) {
                return expression.evaluate().value;
            });
            var strings = quasis.map(function(quasi) {
                return quasi.value.cooked;
            });
            var raw = quasis.map(function(quasi) {
                return quasi.value.raw;
            });
            strings.raw = raw;

            var tanspileArgs = [];
            tanspileArgs.push(strings);
            tanspileArgs.push.apply(tanspileArgs, values);
            var transpiled = transpileTemplate.apply(null, tanspileArgs);

            var args = [];
            var templateObject = state.file.addTemplateObject(
                'taggedTemplateLiteral',
                t.arrayExpression([
                    t.stringLiteral(transpiled)
                ]),
                t.arrayExpression([
                    t.stringLiteral(transpiled)
                ])
            );
            args.push(templateObject);
            path.replaceWith(t.callExpression(node.tag, args));
        }

        return {
            visitor: {
                TaggedTemplateExpression: visitTaggedTemplateExpression
            }
        };
    }
    function getAfterFlattenFeatures() {
        var createFeatures = function() {
            // ça je peux le récup depuis le cache mais bon pour le moment ignorons
            return fsAsync.getFileContent(featuresPath).then(function(code) {
                var babel = require('babel-core');
                var result = babel.transform(code, {
                    plugins: [
                        [customPlugin, {tag: 'transpile'}]
                    ]
                });
                return result.code;
            });
        };

        return createFeatures();
    }
    function ensureImplementation() {
        return getAfterFlattenReport(options).then(
            reviveReport
        ).then(function(afterReport) {
            var remainingProblematicFeatures = afterReport.features.filter(function(feature) {
                var currentFeature = implementation.get(feature.name);
                return currentFeature.isEnabled() && feature.isInvalid();
            });
            if (remainingProblematicFeatures.length) {
                remainingProblematicFeatures.forEach(function(feature) {
                    var featureTask = findFeatureTask(feature);
                    if (!featureTask) {
                        throw new Error('cannot find task for feature ' + feature.name);
                    }
                    console.log(featureTask.name, 'is not a valid alternative for feature ' + feature.name);
                    if (feature.name === 'function-prototype-name-var') {
                        console.log('feature', implementation.get(feature.name));
                    }
                });
                return Promise.reject();
            }
            // console.log(problematicFeatures.length, 'feature have been provided by alternative');
        });
    }
    function getAfterFlattenReport() {
        var createReport = scan;

        if (options.cache) {
            return getAfterFlattenStoreEntry({
                features: [] // à récup
            }).then(function(entry) {
                return memoize.file(
                    createReport,
                    entry.path + '/report-after-flatten.json',
                    [
                        rootFolder + '/features/features.js',
                        rootFolder + '/features/fix.js'
                        // dépend d'un troisième fichier '.jsenv.js'
                        // qui n'existe pas encore mais spécifiera quelles features on utilise
                        // parmi ce qui est disponible
                    ],
                    'eTag'
                )();
            });
        }

        return createReport();
    }

    return Promise.resolve().then(function() {
        return getBeforeFlattenFeatures().then(function(code) {
            eval(code); // eslint-disable-line no-eval
        });
    }).then(function() {
        return scanImplementation();
    }).then(function() {
        return fixImplementation();
    }).then(function() {
        return getAfterFlattenFeatures().then(function(code) {
            implementation.features = [];
            eval(code); // eslint-disable-line no-eval
        });
    }).then(function() {
        return ensureImplementation();
    });
}

Promise.resolve().then(function() {
    return flattenImplementation(options);
}).then(function() {
    return start(options);
}).catch(function(e) {
    if (e) {
        // because unhandled rejection may not be available so error gets ignored
        setTimeout(function() {
            // console.log('the error', e);
            throw e;
        });
    }
});
