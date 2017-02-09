/*
ensure implementation has a list of features we want to use
*/

/* eslint-disable dot-notation */

/*
faut trouver un nom qui parle pour tout ça:

- modifier le code de getFileStore pour ajouter store/branch/entry/data

- améliorer memoize.file pour qu'on puisse lui passer directement
une storeEntry et pas qu'elle soit créé dynamiquement

*/

var rootFolder = '../..';
var cacheFolder = rootFolder + '/cache';
var featuresPath = rootFolder + '/src/features/features.js';
var solutionsPath = rootFolder + '/src/features/solutions.js';

var memoize = require('../memoize.js');
var fsAsync = require('../fs-async.js');
var store = require('../store.js');

var jsenv = global.jsenv;
var Iterable = jsenv.Iterable;
var handlers = {};
var options = {
    cache: true
};
var beforeFixFeaturesEntryProperties = {
    path: cacheFolder + '/features.js',
    sources: [
        {path: featuresPath, strategy: 'mtime'}
    ]
};
var beforeFixReportEntryProperties = {
    name: 'report.json',
    sources: [
        {path: featuresPath, strategy: 'eTag'}
    ]
};
var afterFixFeaturesEntryProperties = {
    name: 'features.js',
    sources: [
        {path: featuresPath, strategy: 'mtime'},
        {path: solutionsPath, strategy: 'mtime'}
    ]
};
var afterFixReportEntryProperties = {
    name: 'report.json',
    sources: [
        {path: featuresPath, strategy: 'eTag'},
        {path: solutionsPath, strategy: 'eTag'}
        // servira à spécifier quelles features on utilise parmi celles dispos
        // {name: '.jsenv.js', strategy: 'eTag'}
    ]
};

var solutions = require(solutionsPath);
function filterFeatureWithoutSolution(features) {
    return Iterable.filter(features, function(feature) {
        return featureHasSolution(feature) === false;
    });
}
function featureHasSolution(feature) {
    return findFeatureSolution(feature) !== null;
}
function findFeatureSolution(feature) {
    return Iterable.find(solutions, function(solution) {
        return Iterable.find(solution.features, function(featureName) {
            return feature.match(featureName);
        });
    });
}

handlers['INITIAL'] = function(state) {
    return getBeforeFixCacheBranch(state).then(
        getBeforeFixReportEntry
    ).then(function(entry) {
        return entry.read();
    }).then(function(data) {
        if (data.valid) {
            state.report = data.value;
            // go to next step (SCAN)
            return getInstruction('SCAN', state, true);
        }
        return getBeforeFixFeatures().then(function(features) {
            var instruction = {
                code: 'SCAN',
                detail: {
                    scan: features
                }
            };
            return instruction;
        });
    });
};
function getBeforeFixCacheBranch(state) {
    return getBeforeFixCache().then(function(cache) {
        return cache.match({
            userAgent: state.userAgent
        });
    });
}
function getBeforeFixCache() {
    var path = cacheFolder + '/before-fix';
    return store.fileSystemCache(path);
}
function getBeforeFixReportEntry(cacheBranch) {
    return cacheBranch.entry(beforeFixReportEntryProperties);
}
function getBeforeFixFeatures() {
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
        createFeatures = memoize.async(
            createFeatures,
            store.fileSystemEntry(beforeFixFeaturesEntryProperties)
        );
    }

    return createFeatures();
}

handlers['SCAN'] = function(state, shortCircuited) {
    if (!shortCircuited) {
        writeBeforeFixReport({
            userAgent: state.userAgent
        }, state.report);
    }

    var implementation = createImplementation(state.report);
    var problematicFeatures = implementation.getProblematicFeatures();
    var problematicFeaturesWithoutSolution = filterFeatureWithoutSolution(problematicFeatures);
    if (problematicFeaturesWithoutSolution.length) {
        var problems = Iterable.map(problematicFeaturesWithoutSolution, function(feature) {
            return {
                type: 'feature-has-no-solution',
                meta: {
                    feature: {
                        name: feature.name
                    }
                }
            };
        });
        return Promise.reject({
            code: 'FAIL',
            reason: 'missing-solution',
            detail: problems
        });
    }

    var instruction = {
        code: '', // 'FIX+COMPLETE'ou 'FIX+SCAN'
        detail: {
            fix: '', // contient le code à éxécuter pour fix une partie des features
            scan: '' // vide si 'FIX', sinon contient le code à éxécuter avant de refaire le scan
        }
    };

    function getAfterFixFeatures(cacheBranch) {
        function createAfterFixFeatures() {
            var requiredTranspileSolutions = Iterable.filter(solutions, function(solution) {
                return solution.type === 'transpile' && solution.isRequired(implementation);
            });
            var requiredPlugins = requiredTranspileSolutions.map(function(solution) {
                return {
                    name: solution.name,
                    options: solution.getConfig(implementation)
                };
            });

            return Promise.all([
                getTranspiler(requiredPlugins),
                fsAsync.getFileContent(featuresPath)
            ]).then(function([transpiler, code]) {
                var babel = require('babel-core');
                var plugin = createTransformTemplateLiteralsTaggedWithPlugin(function(code) {
                    return transpiler.transpile(code, featuresPath, {
                        as: 'code',
                        cache: false // c'est le seul cas connu
                        // ou il ne faut pas mettre en cache le résultat
                        // puisque le fichier est stocké ailleurs
                        // on pourrait aussi le chercher à cet endroit
                        // mais c'est plus pénible car il faut connaitre la liste
                        // des plugins babel utilisé pour matcher dessus
                    });
                }, 'transpile');

                var result = babel.transform(code, {
                    plugins: [
                        [plugin]
                    ]
                });
                return result.code;
            });
        }

        var featureEntry = cacheBranch.entry(afterFixFeaturesEntryProperties);
        return memoize.async(createAfterFixFeatures, featureEntry)();
    }

    return getAfterFixCacheBranch({
        userAgent: state.userAgent,
        problematicFeatures: problematicFeatures
    }).then(function(cacheBranch) {
        var reportEntry = getAfterFixReportEntry(cacheBranch);
        var requiredPolyfillSolutions = Iterable.filter(solutions, function(solution) {
            return solution.type === 'polyfill' && solution.isRequired(implementation);
        });

        return Promise.all([
            reportEntry.read(),
            getPolyfiller(requiredPolyfillSolutions)
        ]).then(function([polyfiller, data]) {
            if (data.valid) {
                state.report = data.value;
                // si le précédent rapport fail alors on le dit au client
                // y'a même pas besoin de fix (getInstruction va reject)
                // sinon dans le then on donne bien l'instruction de fix
                return getInstruction('FIX', state, true).then(function() {
                    instruction.code = 'FIX+COMPLETE';
                    instruction.detail.fix = polyfiller.code;
                    return instruction;
                });
            }
            return getAfterFixFeatures(cacheBranch).then(function(code) {
                instruction.code = 'FIX+SCAN';
                instruction.detail.fix = polyfiller.code;
                instruction.detail.scan = code;
                return instruction;
            });
        });
    });
};
function writeBeforeFixReport(meta, value) {
    return getBeforeFixCacheBranch(meta).then(
        getBeforeFixReportEntry
    ).then(function(entry) {
        return entry.write(value);
    });
}
function createImplementation(report) {
    var features = Iterable.map(report.features, function(featureData) {
        var feature = jsenv.createFeature(featureData.name);
        jsenv.assign(feature, featureData);
        return feature;
    });
    var implementation = {
        features: features,
        get: function(name) {
            var foundfeature = Iterable.find(this.features, function(feature) {
                return feature.match(name);
            });
            if (!foundfeature) {
                throw new Error('feature not found ' + foundfeature);
            }
            return foundfeature;
        },

        getProblematicFeatures: function() {
            return Iterable.filter(features, function(feature) {
                return feature.isProblematic();
            });
        }
    };

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
        implementation.get(featureName).disable('babel do not provide this');
    });
    implementation.get('function-prototype-name-description').disable('cannot be polyfilled');

    return implementation;
}
function getAfterFixCacheBranch(meta) {
    return getAfterFixCache().then(function(cache) {
        return cache.match(meta);
    });
}
function getAfterFixCache() {
    var path = cacheFolder + '/after-fix';
    return store.fileSystemCache(path);
}
function getAfterFixReportEntry(cacheBranch) {
    return cacheBranch.entry(afterFixReportEntryProperties);
}
function getPolyfiller(requiredSolutions) {
    var requiredModules = Iterable.filter(requiredSolutions, function(solution) {
        return solution.author === 'corejs';
    });
    var requiredFiles = Iterable.filter(requiredSolutions, function(solution) {
        return solution.author === 'me';
    });
    var requiredModuleNames = Iterable.map(requiredModules, function(module) {
        return module.name;
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
        var getPolyfillCacheBranch = function(meta) {
            var path = cacheFolder + '/polyfill';
            return store.fileSystemCache(path).then(function(cache) {
                return cache.match(meta);
            });
        };

        return getPolyfillCacheBranch({
            coreJs: requiredModuleNames,
            files: requiredFilePaths
        }).then(function(storeBranch) {
            return memoize.async(
                createPolyfill,
                storeBranch.entry({
                    name: 'polyfill.js',
                    sources: requiredFilePaths.map(function(filePath) {
                        return {
                            path: filePath,
                            strategy: 'mtime'
                        };
                    })
                })
            )();
        }).then(function(code) {
            return {
                code: code
            };
        });
    }

    return createPolyfill().then(function(polyfill) {
        return {
            code: polyfill
        };
    });
}
function getTranspiler(requiredPlugins) {
    console.log('required babel plugins', requiredPlugins.map(function(plugin) {
        return plugin.name;
    }));
    var pluginsAsOptions = Iterable.map(requiredPlugins, function(plugin) {
        return [plugin.name, plugin.options];
    });

    var transpile = function(code, filename, transpilationOptions) {
        transpilationOptions = transpilationOptions || {};

        var transpileCode = function(sourceURL) {
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

        if (options.cache && transpilationOptions.cache !== false) {
            var nodeFilePath;
            if (filename.indexOf('file:///') === 0) {
                nodeFilePath = filename.slice('file:///'.length);
            } else {
                nodeFilePath = filename;
            }

            if (nodeFilePath.indexOf(rootFolder) === 0) {
                var relativeFilePath = nodeFilePath.slice(rootFolder.length);

                var getTranspileCacheBranch = function(meta) {
                    var path = cacheFolder + '/transpile';
                    return store.fileSystemCache(path).then(function(store) {
                        return store.match(meta);
                    });
                };

                return getTranspileCacheBranch({
                    plugins: pluginsAsOptions
                }).then(function(storeBranch) {
                    var entry = storeBranch.entry({
                        name: 'modules/' + relativeFilePath,
                        sources: [
                            {path: nodeFilePath, strategy: 'mtime'}
                        ]
                    });

                    return memoize.async(
                        transpileCode,
                        entry
                    )(entry.path);
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
function createTransformTemplateLiteralsTaggedWithPlugin(transpile, TAG_NAME) {
    TAG_NAME = TAG_NAME || 'transpile';

    function transformTemplateLiteralsTaggedWithPlugin(babel) {
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
                return transpile(result);
            } catch (e) {
                // if there is an error
                // let test a chance to eval untranspiled string
                // and catch error it may be a test which is trying
                // to ensure compilation error (syntax error for example)
                return result;
            }
        }

        function visitTaggedTemplateExpression(path, state) {
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

    return transformTemplateLiteralsTaggedWithPlugin;
}

handlers['FIX'] = function(state, shortCircuited) {
    var implementation = createImplementation(state.report);
    var problematicFeatures = implementation.getProblematicFeatures();

    if (!shortCircuited) {
        writeAfterFixReport({
            userAgent: state.userAgent,
            problematicFeatures: problematicFeatures
        }, state.report);
    }

    if (problematicFeatures.length) {
        var problems = Iterable.map(problematicFeatures, function(feature) {
            var solution = findFeatureSolution(feature);

            return {
                type: 'feature-solution-is-invalid',
                meta: {
                    feature: {
                        name: feature.name
                    },
                    solution: {
                        name: solution.name,
                        type: solution.type,
                        author: solution.author
                    }
                }
            };
        });
        return Promise.reject({
            code: 'FAIL',
            reason: 'invalid-solution',
            detail: problems
        });
    }
    return Promise.resolve({
        code: 'COMPLETE',
        reason: 'fixed',
        detail: undefined
    });
};
function writeAfterFixReport(meta, value) {
    return getAfterFixCacheBranch(meta).then(
        getAfterFixReportEntry
    ).then(function(entry) {
        return entry.write(value);
    });
}

function getInstruction(step, state, shortCircuited) {
    return new Promise(function(resolve) {
        resolve(handlers[step](state, shortCircuited));
    }).catch(function() {
        // si e est une instruction nickel
        // sinon on fail avec reason = 'throw' et detail = e
    });
}

module.exports = function(state, resolve) {
    return getInstruction(state.step, state).then(resolve);
};
