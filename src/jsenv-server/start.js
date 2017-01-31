/* eslint-disable no-path-concat */

/*

- utiliser babel sur le fichier de test pour pourvoir utiliser les templates string
ça sera plus proppre, la conversion de fait auto à l'éxécution de ce fichier

- voir s'il est possible d'utiliser babel-plugin-transform-eval pour transpiler
et créer un fichiuer de test spécifique au transpileur

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

- où stocker l'info pour dire ce type de client a pu être polyfillé correctement ou non ?

- quand et comment le client lance-t-il une première requête de compatibilité avec les features requises ?
-> au chargement de la page, avant toute chose et à chaque fois on demande au serveur si on est compatiblez
- sous quel format dit-on au client: voici les tests que tu dois lancer ?
-> 200 + une sorte de json contenant tous les tests serais top, le prob étant que ce n'est pas leur forme actuelle
autre souci du JSON: les fonctions devraient être eval, un peu relou
le plus simple serait donc de renvoyer un js
peut être que les tests resteront dans index.js mais que on les lance pas si pas besoin
de sorte qu'on garde la possibilité de les lancer si on le souhaite pour whatever raison
- sous quel format dit-on au client: c'est mort tu n'est pas polyfillable ?
-> on lui renvoit un code d'erreur genre pas 200 avec un message associé
- sous quel format dit-on au client: voici le polyfill que tu dois éxécuter, pas besoin de test ?
-> 200 + le pollyfill en tant que fichier js qu'on éxécute sans se poser de question

- continuer sur l'import de server.js

- une fois que le serveur peut être lancé celui-ci va être capable de plusieurs chose

- externaliser sourcemap au lie de inline base64, enfin faire une option
cela signifie que pour que le cache soit valide il faudra aussi check l'existance de son fichier sourcemap
ou alors toruver une autre soluce

- yield, async, generator, prévoir les features/plugins/polyfill correspondant

- race condition writefile ?
si oui faudrais une queue de write pour s'assurer que la dernière version est bien celle
qui est finalement écrit

- more : npm install dynamique

*/

require('../../index.js');

var jsenv = global.jsenv;
var Iterable = jsenv.Iterable;
var implementation = jsenv.implementation;
var cuid = require('cuid');
var memoize = require('./memoize.js');
var fsAsync = require('./fs-async.js');
var rootPath = jsenv.dirname.slice('file:///'.length);

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
        // pas vraiment polyfillable si function-description est non configurable
        // on ne pourra rien y faire, du coup faut l'exclure non ?
        // 'function-prototype-name-description'
    ]
});
coreJSModule('es6.object.assign', {
    features: [
        'object-assign'
    ]
});

var fileTasks = [];
function file(name, descriptor) {
    if (name[0] === '.' && name[1] === '/') {
        name = rootPath + name.slice(1);
    }

    var task = createTask(name, descriptor);

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
babelPlugin('transform-es2015-modules-systemjs', {
    required: true
});
babelPlugin('check-es2015-constants', {
    required: true
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
        'const-throw-statement',
        'const-throw-redefine',
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
babelPlugin('transform-es2015-function-name', {
    required: 'auto',
    features: [
        'function-prototype-name-statement',
        'function-prototype-name-expression',
        'function-prototype-name-new',
        'function-prototype-name-bind',
        'function-prototype-name-var',
        'function-prototype-name-accessor',
        'function-prototype-name-method',
        'function-prototype-name-method-shorthand',
        'function-prototype-name-method-shorthand-lexical-binding',
        'function-prototype-name-method-computed-symbol'
    ]
});
babelPlugin('transform-es2015-parameters', {
    required: 'auto',
    features: [
        'function-default-parameters',
        'function-default-parameters-explicit-undefined',
        'function-default-parameters-refer-previous',
        'function-default-parameters-arguments',
        'function-default-parameters-temporal-dead-zone',
        'function-default-parameters-scope-own',
        'function-default-parameters-new-function',

        'function-rest-parameters',
        'function-rest-parameters-throw-setter',
        'function-rest-parameters-length',
        'function-rest-parameters-arguments',
        'function-rest-parameters-new-function'
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
        'spread-function-call-throw-non-iterable',
        // 'spread-function-call-generator',
        'spread-function-call-iterable',
        'spread-function-call-iterable-instance',
        'spread-literal-array',
        // 'spread-literal-array-generator',
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

        'destructuring-assignment-array-empty',
        'destructuring-assignment-array-rest-nest',
        'destructuring-assignment-array-expression-return',
        'destructuring-assignment-array-chain',

        'destructuring-assignment-object-empty',
        'destructuring-assignment-object-expression-return',
        'destructuring-assignment-object-throw-left-parenthesis',
        'destructuring-assignment-object-chain',

        'destructuring-parameters-array-arguments',
        'destructuring-parameters-array-new-function',
        'destructuring-parameters-array-function-length',

        'destructuring-parameters-object-arguments',
        'destructuring-parameters-object-new-function',
        'destructuring-parameters-object-function-length'
    ]
});

function start(options) {
    return flattenImplementation(options).then(function() {
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
    }).then(function() {
        // return System.import(rootPath + '/setup.js').then(function(exports) {
        //     return exports.default(jsenv);
        // });
    });
    // .then(function() {
    //     return System.import('./server.js');
    // });
}
function scan() {
    console.log('scanning implementation');
    return new Promise(function(resolve) {
        implementation.scan(resolve);
    });
}
function flattenImplementation(options) {
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
    function reviveReport(report) {
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

    implementation.disable('function-prototype-name-description');

    return getBeforeFlattenReport(options).then(
        reviveReport
    ).then(function(beforeReport) {
        var features = beforeReport.features;
        callEveryHook('afterScanHook', features);
        var unhandledProblematicFeatures = features.filter(function(feature) {
            return feature.isEnabled() && feature.isInvalid();
        });
        if (unhandledProblematicFeatures.length) {
            throw new Error('no solution for: ' + unhandledProblematicFeatures.join(','));
        }

        return getPolyfill(options).then(function(content) {
            callEveryTaskHook(coreJSTasks, 'beforeInstallHook');
            callEveryTaskHook(fileTasks, 'beforeInstallHook');
            return content;
        }).then(function(content) {
            if (content) {
                eval(content); // eslint-disable-line
            }
        }).then(function() {
            callEveryTaskHook(coreJSTasks, 'afterInstallHook');
            callEveryTaskHook(fileTasks, 'afterInstallHook');
        }).then(function() {
            return getTranspiler(options);
        }).then(function(transpiler) {
            callEveryTaskHook(babelTasks, 'beforeInstallHook');
            return transpiler;
        }).then(function(transpiler) {
            return installTranspiler(transpiler, options);
        }).then(function() {
            callEveryTaskHook(babelTasks, 'afterInstallHook');
        }).then(function() {
            return getAfterFlattenReport(options);
        }).then(
            reviveReport
        ).then(function(afterReport) {
            function findFeatureTask(feature) {
                var tasks = coreJSTasks.concat(fileTasks, babelTasks);
                return Iterable.find(tasks, function(task) {
                    return Iterable.find(task.features, function(taskFeature) {
                        return taskFeature.match(feature);
                    });
                });
            }

            // faudrais faire un tru comme ça afin de pouvoir retester
            // jsenv.implementation.features.forEach(function(feature) {
            //     feature.status = 'unspecified';
            // });

            var remainingProblematicFeatures = afterReport.features.filter(function(feature) {
                var currentFeature = jsenv.implementation.get(feature.name);
                return currentFeature.isEnabled() && feature.isInvalid() && currentFeature.type !== 'syntax';
            });
            if (remainingProblematicFeatures.length) {
                remainingProblematicFeatures.forEach(function(feature) {
                    var featureTask = findFeatureTask(feature);
                    if (!featureTask) {
                        throw new Error('cannot find task for feature ' + feature.name);
                    }
                    console.log(featureTask.name, 'is not a valid alternative for feature ' + feature.name);
                });
                return Promise.reject();
            }
            // console.log(problematicFeatures.length, 'feature have been provided by alternative');
        });
    });
}
function getBeforeFlattenReport(options) {
    var createReport = scan;

    if (options.cacheFolder) {
        createReport = memoize.file(
            createReport,
            options.cacheFolder + '/implementation-report-before-flatten.json',
            rootPath + '/index.js',
            'eTag'
        );
    }

    return createReport();
}
function getAfterFlattenReport(options) {
    var createReport = scan;

    if (options.cacheFolder) {
        createReport = memoize.file(
            createReport,
            options.cacheFolder + '/implementation-report-after-flatten.json',
            rootPath + '/index.js',
            'eTag'
        );
    }

    return createReport();
}

function getPolyfill(options) {
    function createCoreJSPolyfill() {
        var requiredModules = coreJSTasks.filter(function(module) {
            return module.required;
        });
        var requiredModulesAsOption = requiredModules.map(function(module) {
            return module.name;
        });

        console.log('required corejs modules', requiredModulesAsOption);

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
        var requiredFiles = Iterable.filter(fileTasks, function(file) {
            return file.required;
        });
        var requiredFilePaths = Iterable.map(requiredFiles, function(file) {
            return file.name;
        });
        console.log('required files', requiredFilePaths);

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

    var createPolyfill = function() {
        return Promise.all([
            createCoreJSPolyfill(),
            createOwnFilePolyfill()
        ]).then(function(sources) {
            return sources.join('\n\n');
        });
    };

    if (options.cacheFolder) {
        var requiredFiles = Iterable.filter(fileTasks, function(file) {
            return file.required;
        });
        var requiredFilesNames = requiredFiles.map(function(file) {
            return file.name;
        });

        createPolyfill = memoize.file(
            createPolyfill,
            options.cacheFolder + '/polyfill.js',
            requiredFilesNames,
            'mtime'
        );
    }

    return createPolyfill();
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

    var babel = require('babel-core');
    var transpile = function(code, filename) {
        // https://babeljs.io/docs/core-packages/#options
        // inputSourceMap: null,
        // minified: false
        return babel.transform(code, {
            filename: filename,
            sourceMaps: 'inline',
            plugins: pluginsAsOptions
        }).code;
    };

    return Promise.resolve({
        transpile: transpile
    });
}
function installTranspiler(transpiler, options) {
    jsenv.global.System.translate = function(load) {
        var code = load.source;
        var filename = load.address;

        load.metadata.format = 'register';

        var transpile = function() {
            var result = transpiler.transpile(code, filename);
            result += '\n//# sourceURL=' + filename + '!transpiled';
            return result;
        };

        if (options.cacheFolder) {
            var baseURL = String(jsenv.baseURL);

            if (filename.indexOf(baseURL) === 0) {
                var relativeFilePath = filename.slice(baseURL.length);
                var nodeFilePath = filename.slice('file:///'.length);
                transpile = memoize.file(
                    transpile,
                    options.cacheFolder + '/modules/' + relativeFilePath,
                    nodeFilePath,
                    'mtime'
                );
            }
        }

        return transpile();
    };
}
function getCache(folderPath) {
    var entriesPath = folderPath + '/entries.json';

    function add() {
        var i = arguments.length;
        var total = 0;
        while (i--) {
            total += arguments[i];
        }
        return total;
    }
    function getEntryLastMatch(entry) {
        return Math.max.apply(null, entry.branches.map(function(branch) {
            return branch.lastMatch;
        }));
    }
    function getEntryMatchCount(entry) {
        return add.apply(null, entry.branches.map(function(branch) {
            return branch.matchCount;
        }));
    }
    function compareEntry(a, b) {
        var order;
        var aLastMatch = getEntryLastMatch(a);
        var bLastMatch = getEntryLastMatch(b);
        var lastMatchDiff = aLastMatch - bLastMatch;

        if (lastMatchDiff === 0) {
            var aMatchCount = getEntryMatchCount(a);
            var bMatchCount = getEntryMatchCount(b);
            var matchCountDiff = aMatchCount - bMatchCount;

            order = matchCountDiff;
        } else {
            order = lastMatchDiff;
        }

        return order;
    }

    return fsAsync.getFileContent(entriesPath, '[]').then(JSON.parse).then(function(entries) {
        var cache = {
            match: function(state) {
                var foundBranch;
                var foundEntry = Iterable.find(entries, function(entry) {
                    foundBranch = Iterable.find(entry.branches, function(branch) {
                        return (
                            state.agent.match(branch.condition.agent) &&
                            state.platform.match(branch.condition.platform)
                        );
                    });
                    return Boolean(foundBranch);
                });

                if (foundEntry) {
                    foundBranch.matchCount = 'matchCount' in foundBranch ? foundBranch.matchCount + 1 : 1;
                    foundBranch.lastMatch = Math.max(foundBranch.lastMatch, Number(Date.now()));
                    return cache.update().then(function() {
                        return foundEntry;
                    });
                }

                var entry = {
                    name: cuid(),
                    branches: [
                        {
                            condition: {
                                agent: String(state.agent),
                                platform: String(state.platform)
                            },
                            matchCount: 1,
                            lastMatch: Number(Date.now())
                        }
                    ]
                };

                entries.push(entry);
                return cache.update().then(function() {
                    return entry;
                });
            },

            update: function() {
                entries = entries.sort(compareEntry);

                console.log('set file content', entriesPath);

                return fsAsync.setFileContent(entriesPath, JSON.stringify(entries, null, '\t')).then(function() {
                    return entries;
                });
            }
        };

        return cache;
    });
}
var mainCacheFolder = rootPath + '/cache';
getCache(mainCacheFolder).then(function(cache) {
    return cache.match({
        agent: jsenv.agent,
        platform: jsenv.platform
    }).then(function(entry) {
        return start({
            cacheFolder: mainCacheFolder + '/' + entry.name
        });
    });
}).catch(function(e) {
    if (e) {
        // because unhandled rejection may not be available so error gets ignored
        setTimeout(function() {
            // console.log('the error', e);
            throw e;
        });
    }
});
