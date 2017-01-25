/* eslint-disable no-path-concat */

/*

- pouvoir importer server.js sans problème

- trover une solution de cache qui permet de dire
j'ai a, b, c en entrée -> c'est là
si j'ai a, b -> c'est là
puisqu'on ne peut pas utiliser directement le nom du fichier peut être
qu'un md5 de a+b+c ou alors un mapping.json qui dit "0": "a,b,c", "1": "a, b"
en gros ce mapping sers à savoir à quoi correspond chaque fichier

- démarrer un serveur de dev qui sera charger de fournir le polyfill et de transpiler
le js d'un client qui s'y connecte

pour faire ça faut pouvoir charger les modules en utilisant SystemJS
pour le moment je vois aucune raison de ne pas s'en servir directement
sans se prendre la tête plus que ça

- une fois que ça marcheras faudra reporter ce comportement sur le browser qui demandera au serveur
un build de polyfill et communiquera aussi les babel plugins dont il a besoin

- yield, async, generator, prévoir les features/plugins/polyfill correspondant

- à un moment il faudrais mettre en cache les builds de polyfill pour éviter de les reconstruire tout le temps
mais on retarde ça le plus possible parce que ça a des impacts (comment invalider ce cache etc) et c'est dispensable

- more : npm install dynamique

*/

require('./index.js');
var fs = require('fs');

function add() {
    var i = arguments.length;
    var total = 0;
    while (i--) {
        total += arguments[i];
    }
    return total;
}
function createExecutorCallback(resolve, reject) {
    return function(error, result) {
        if (error) {
            reject(error);
        } else {
            resolve(result);
        }
    };
}
function getFileStat(path) {
    return new Promise(function(resolve, reject) {
        fs.stat(path, createExecutorCallback(resolve, reject));
    }).catch(function(error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        return Promise.reject(error);
    });
}
function getFileContent(path, defaultContent) {
    if (arguments.length === 0) {
        throw new Error('missing arg to createFile');
    }

    return new Promise(function(resolve, reject) {
        fs.readFile(path, createExecutorCallback(resolve, reject));
    }).then(
        function(buffer) {
            var content = String(buffer);
            return content;
        },
        function(e) {
            if (e.code === 'ENOENT') {
                var content = defaultContent || '';

                return new Promise(function(resolve, reject) {
                    fs.writeFile(path, content, createExecutorCallback(resolve, reject));
                }).then(function() {
                    return content;
                });
            }
            return Promise.reject(e);
        }
    );
}
function getFolderContent(path) {
    return new Promise(function(resolve, reject) {
        fs.readdir(path, createExecutorCallback(resolve, reject));
    }).catch(function(error) {
        if (error.code === 'ENOENT') {
            return new Promise(function(resolve, reject) {
                fs.mkdir(path, createExecutorCallback(resolve, reject));
            }).then(function() {
                return [];
            });
        }
        return Promise.reject(error);
    });
}
function createFolder(path) {
    return new Promise(function(resolve, reject) {
        fs.mkdir(path, createExecutorCallback(resolve, reject));
    }).catch(function(error) {
        // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
        if (error.code === 'EEXIST') {
            // vérifie que c'est bien un dossier
            return getFileStat(path).then(function(stat) {
                if (stat) {
                    if (stat.isDirectory()) {
                        return;
                    }
                    // on pourrais essayer de supprimer le fichier/symlink/... mais bon pour le moment on throw
                    // plus tard on supprimera puis on referas createFolder
                    // ce cas peut se produire lorsque durant la vie du projet
                    // je crée un fichier puis un dossier ayant le même nom alors le cache se retrouve dans cet état
                    throw error;
                }
                // sinon c'est que la ressource a été supprimée entre temps
                // soit on rapelle createFolder dessus, soit on se dit ok laisse tomber c'est
            });
        }
        return Promise.reject(error);
    });
}
function createFoldersTo(path) {
    var folders = path.replace(/\\/g, '/').split('/');

    folders.pop();

    return folders.reduce(function(previous, directory, index) {
        var folderPath = folders.slice(0, index + 1).join('/');

        return previous.then(function() {
            return createFolder(folderPath);
        });
    }, Promise.resolve());
}
function setFileContent(path, content) {
    return createFoldersTo(path).then(function() {
        return new Promise(function(resolve, reject) {
            fs.writeFile(path, content, createExecutorCallback(resolve, reject));
        });
    });
}

var jsenv = global.jsenv;
var implementation = jsenv.implementation;
var Iterable = jsenv.Iterable;

var disabledFeatures = [
    'math-clamp',
    'math-deg-per-rad',
    'math-degrees',
    'math-fscale',
    'math-radians',
    'math-rad-per-deg',
    'math-scale',
    'string-escape-html',
    'string-match-all',
    'string-unescape-html'
];
disabledFeatures.forEach(function() {
    // implementation.disable(excludedFeature, 'npm corejs@2.4.1 does not have thoose polyfill');
});
implementation.disable('function-prototype-name-description');

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
        name = __dirname.replace(/\\/g, '/') + name.slice(1);
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

function createUpToDateValidator(otherFilePath) {
    var debug = false;

    return function upToDateValidator() {
        var self = this;

        return getFileStat(otherFilePath).then(function(otherFileStat) {
            if (otherFileStat) {
                if (self.stat.mtime >= otherFileStat.mtime) {
                    if (debug) {
                        console.log(self.path, 'uptodate with', otherFilePath);
                    }
                    return true;
                }
                if (debug) {
                    console.log(self.path, 'outdated against', otherFilePath);
                }
                return false;
            }
            if (debug) {
                console.log('otherFile does no exists', otherFilePath);
            }
            return false;
        });
    };
}
function composeValidators(validators) {
    var rejectedBecauseInvalid = {};

    return function composedValidator() {
        var self = this;
        var args = arguments;
        var validationPromises = validators.map(function(validator) {
            return validator.apply(self, args).then(function(valid) {
                if (valid) {
                    return true;
                }
                return Promise.reject(rejectedBecauseInvalid);
            });
        });

        return Promise.all(validationPromises).then(function() {
            return true;
        }).catch(function(e) {
            if (e === rejectedBecauseInvalid) {
                return false;
            }
            return Promise.reject(e);
        });
    };
}
function createContent(generator) {
    var linkedFile = null;

    var content = {
        produce: function() {
            // check first if the linkedfile already have a valid content (cache)
            if (linkedFile) {
                return getFileStat(linkedFile.path).then(function(stat) {
                    linkedFile.stat = stat;
                    if (stat) {
                        return linkedFile.validate(linkedFile);
                    }
                    return false;
                }).then(function(valid) {
                    if (valid) {
                        return getFileContent(linkedFile.path).then(function(content) {
                            return linkedFile.readTransform(content);
                        });
                    }
                    return Promise.resolve(generator()).then(function(content) {
                        // we do not care if setFileContent succeeds or fails
                        // and we don't want to do anything special in both case, so let it like that
                        Promise.resolve(linkedFile.writeTransform(content)).then(function(content) {
                            setFileContent(linkedFile.path, content);
                        });
                        return content;
                    });
                });
            }
            return Promise.resolve(generator());
        },

        linkFile: function(path, options) {
            linkedFile = {
                path: path,

                readTransform: function(content) {
                    return content;
                },

                writeTransform: function(content) {
                    return content;
                },

                validate: function() {
                    return true;
                }
            };
            jsenv.assign(linkedFile, options);
        }
    };

    return content;
}

function start(options) {
    return ensureFeatures(options).then(function() {
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

        registerCoreModule(prefixModule(jsenv.rootModuleName), jsenv);
        registerCoreModule(prefixModule(jsenv.moduleName), jsenv);
        registerCoreModule('@node/require', require);
    }).then(function() {
        return System.import('./setup.js').then(function(exports) {
            return exports.default(jsenv);
        });
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
function ensureFeatures(options) {
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

    return getReport(options).then(function(report) {
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
    }).then(function(report) {
        var features = report.features;
        // var problematicFeatures = features.filter(function(feature) {
        //     return feature.isEnabled() && feature.isInvalid();
        // });
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
            // le fait de tester une fois le polyfill créer
            // n'a besoin d'être fait qu'une seule fois
            // mais ne se fait pas direct ici
            // il se peut qu'on demande au client de tester et non pas à soi-même
            // et dans ce cas il doit retester un sous ensemble de toutes les features
            // (selement celles qui sont problématiques)
            // le client pourrait être assez intelligent pour le faire automatiquement
            // et c'est surement ce qu'on fera sauf que
            // lorsqu'on est dans lemême thread, et c'est le cas pour ce script
            // le status des features doit être mis correctement à jour afin de pouvoir retester
            // function findFeatureTask(feature) {
            //     var tasks = coreJSTasks.concat(fileTasks, babelTasks);
            //     return Iterable.find(tasks, function(task) {
            //         return Iterable.find(task.features, function(taskFeature) {
            //             return taskFeature.match(feature);
            //         });
            //     });
            // }

            // // jsenv.implementation.features.forEach(function(feature) {
            // //     feature.status = 'unspecified';
            // // });

            // return scan().then(function(secondReport) {
            //     var remainingProblematicFeatures = secondReport.features.filter(function(feature) {
            //         var currentFeature = jsenv.implementation.get(feature.name);
            //         return currentFeature.isEnabled() && feature.isInvalid() && currentFeature.type !== 'syntax';
            //     });
            //     if (remainingProblematicFeatures.length) {
            //         remainingProblematicFeatures.forEach(function(feature) {
            //             var featureTask = findFeatureTask(feature);
            //             if (!featureTask) {
            //                 throw new Error('cannot find task for feature ' + feature.name);
            //             }
            //             console.log(featureTask.name, 'is not a valid alternative for feature ' + feature.name);
            //         });
            //         return Promise.reject();
            //     }
            //     // console.log(problematicFeatures.length, 'feature have been provided by alternative');
            // });
        });
    });
}
function getReport(options) {
    var reportContent = createContent(function() {
        return scan();
    });

    if (options.cacheFolder) {
        var cacheFolder = options.cacheFolder;
        var cachedReportPath = cacheFolder + '/implementation-report.json';

        reportContent.linkFile(cachedReportPath, {
            readTransform: function(content) {
                return JSON.parse(content);
            },

            writeTransform: function(content) {
                return JSON.stringify(content, null, '\t');
            },

            validate: createUpToDateValidator('./index.js')
        });
    }

    return reportContent.produce();
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

    var polyfill = createContent(function() {
        return Promise.all([
            createCoreJSPolyfill(),
            createOwnFilePolyfill()
        ]).then(function(sources) {
            return sources.join('\n\n');
        });
    });

    if (options.cacheFolder) {
        var cacheFolder = options.cacheFolder;
        var requiredFiles = Iterable.filter(fileTasks, function(file) {
            return file.required;
        });
        var upToDateWithEveryFiles = composeValidators(requiredFiles.map(function(file) {
            return createUpToDateValidator(file.name);
        }));

        polyfill.linkFile(cacheFolder + '/polyfill.js', {
            validate: upToDateWithEveryFiles
        });
    }

    return polyfill.produce();
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

        var module = createContent(function() {
            var result = transpiler.transpile(code, filename);
            result += '\n//# sourceURL=' + filename + '!transpiled';
            return result;
        });

        if (options.cacheFolder) {
            var baseURL = String(jsenv.baseURL);

            if (filename.indexOf(baseURL) === 0) {
                var relativeFilePath = filename.slice(baseURL.length);
                var nodeFilePath = filename.slice('file:///'.length);
                module.linkFile(options.cacheFolder + '/modules/' + relativeFilePath, {
                    validate: createUpToDateValidator(nodeFilePath)
                });
            }
        }

        return module.produce();
    };
}
function getCache(folderPath) {
    var entriesPath = folderPath + '/entries.json';

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

    return getFileContent(entriesPath, '[]').then(JSON.parse).then(function(entries) {
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
                    foundBranch.lastMatch = Number(Date.now());
                    return cache.update().then(function() {
                        return foundEntry;
                    });
                }

                return getFolderContent(folderPath).then(function(names) {
                    var folderName = '0';
                    while (Iterable.includes(names, folderName)) {
                        folderName = String(Number(folderName) + 1);
                    }
                    return folderName;
                }).then(function(entryName) {
                    return {
                        name: entryName,
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
                }).then(function(entry) {
                    // il faut créer le dossier sinon celui-ci serait considéré comme libre
                    return getFolderContent(folderPath + '/' + entry.name).then(function() {
                        entries.push(entry);
                        return cache.update();
                    }).then(function() {
                        return entry;
                    });
                });
            },

            update: function() {
                entries = entries.sort(compareEntry);

                return setFileContent(entriesPath, JSON.stringify(entries, null, '\t')).then(function() {
                    return entries;
                });
            }
        };

        return cache;
    });
}
var mainCacheFolder = './cache';
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
