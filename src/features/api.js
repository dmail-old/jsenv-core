/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

ok je sais d'où vient le problème

lorsqu'on a besoin du fix-output ou tu tets-output d'une feature en particulier
il faut se rapeller que ladite feature peut avoir des dépendances
et qu'il faut ABSOLUMENT régénérer toutes ses dépendances pour pouvoir
la retester et obtenir le résultat

autrement dit lorsqu'on souhaite fix const/scoped
il faut aussi envoyé la feature const même si const est valide
de sorte que lorsqu'on teste const/scoped on a bien const qui existe

*/

require('../jsenv.js');
var path = require('path');
var Iterable = jsenv.Iterable;
var fsAsync = require('../fs-async.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var rootFolder = path.resolve(__dirname, '../..').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var featuresFolderPath = rootFolder + '/src/features';
var polyfillFolder = cacheFolder + '/polyfill';
var createTranspiler = require('./transpiler.js');
var featureTranspiler = createTranspiler({
    cache: true,
    cacheMode: 'default',
    filename: false,
    sourceMaps: false,
    plugins: [
        'transform-es2015-template-literals'
    ]
});
var noSolution = {
    match: function(feature) {
        return feature.solution === 'none';
    }
};
var polyfillSolution = {
    match: function(feature) {
        return (
            feature.solution.type === 'corejs' ||
            feature.solution.type === 'file'
        );
    },

    solve: function(features) {
        var featuresRequiringCoreJS = features.filter(function(feature) {
            return feature.solution.type === 'corejs';
        });
        var requiredCoreJSModules = Iterable.uniq(featuresRequiringCoreJS.map(function(feature) {
            return feature.solution.value;
        }));
        var featureRequiringFiles = features.filter(function(feature) {
            return feature.solution.type === 'file';
        });
        var requiredFiles = Iterable.uniq(featureRequiringFiles.map(function(feature) {
            return require('path').resolve(
                featuresFolderPath + '/' + feature.name + '/feature.js',
                feature.solution.value.replace('${rootFolder}', rootFolder)
            );
        }));

        function createPolyfill() {
            function createCoreJSPolyfill() {
                var source = '';

                // Iterable.forEach(requiredCoreJSModules, function(module) {
                //     if (module.prefixCode) {
                //         source += module.prefixCode;
                //     }
                // });
                var sourcePromise = Promise.resolve(source);
                console.log('concat corejs modules', requiredCoreJSModules);

                return sourcePromise.then(function(source) {
                    if (requiredCoreJSModules.length) {
                        var buildCoreJS = require('core-js-builder');
                        var promise = buildCoreJS({
                            modules: requiredCoreJSModules,
                            librabry: false,
                            umd: true
                        });
                        return promise.then(function(polyfill) {
                            if (source) {
                                source += '\n';
                            }
                            source += polyfill;

                            return source;
                        });
                    }
                    return source;
                });
            }
            function createOwnFilePolyfill() {
                console.log('concat files', requiredFiles);

                var sourcesPromises = Iterable.map(requiredFiles, function(filePath) {
                    return fsAsync.getFileContent(filePath);
                });
                return Promise.all(sourcesPromises).then(function(sources) {
                    return sources.join('\n\n');
                });
            }

            return Promise.all([
                createCoreJSPolyfill(),
                createOwnFilePolyfill()
            ]).then(function(sources) {
                return sources.join('');
            });
        }

        var polyfillCache = store.fileSystemCache(polyfillFolder);
        return polyfillCache.match({
            solutions: {
                files: requiredFiles,
                corejs: requiredCoreJSModules
            }
        }).then(function(cacheBranch) {
            return memoize.async(
                createPolyfill,
                cacheBranch.entry({
                    name: 'polyfill.js',
                    sources: requiredFiles.map(function(filePath) {
                        return {
                            path: filePath,
                            strategy: 'mtime'
                        };
                    })
                })
            )();
        });
    }
};
var transpileSolution = {
    match: function(feature) {
        return feature.solution.type === 'babel';
    },

    solve: function(features) {
        var requiredPlugins = features.map(function(feature) {
            var solution = feature.solution;
            var createOptions = function() {
                var options = {};
                if ('config' in solution) {
                    var config = solution.config;
                    if (typeof config === 'object') {
                        jsenv.assign(options, config);
                    } else if (typeof config === 'function') {
                        jsenv.assign(options, config(features));
                    }
                }
                return options;
            };

            return {
                name: solution.value,
                options: createOptions()
            };
        });
        var pluginsAsOptions = Iterable.map(requiredPlugins, function(plugin) {
            return [plugin.name, plugin.options];
        });
        return createTranspiler({
            cache: true,
            cacheMode: 'default',
            plugins: pluginsAsOptions
        });
    }
};

function getTestOutputEntryProperties(feature) {
    var entryProperties = {
        name: 'test-output.json',
        sources: [
            {
                path: featuresFolderPath + '/' + feature.name + '/feature.js',
                strategy: 'eTag'
            }
        ]
    };
    return entryProperties;
}
function getFixOutputEntryProperties(feature) {
    var featureFilePath = featuresFolderPath + '/' + feature.name + '/feature.js';
    var sources = [
        {
            path: featureFilePath,
            strategy: 'eTag'
        }
    ];
    var solution = feature.solution;
    if (
        solution.type === 'polyfill' &&
        solution.location.indexOf('://') === -1
    ) {
        var solutionPath = require('path').resolve(featureFilePath, solution.location);
        sources.push({
            path: solutionPath,
            strategy: 'etag'
        });
    }
    var entryProperties = {
        name: 'fix-output.json',
        cacheMode: 'write-only',
        sources: sources
    };
    return entryProperties;
}
function toLocalFeatures(features) {
    return features.map(function(feature) {
        return {name: feature.name};
    });
}
function getNextInstruction(instruction) {
    var options = {
        agent: 'Firefox/50.0',
        features: []
    };
    jsenv.assign(options, instruction.options || {});

    return getRequiredFeatures(options.features).then(function(features) {
        var testOutputsPromise;
        if (instruction.name === 'start' || instruction.name === 'fix') {
            testOutputsPromise = readOutputsFromFileSystem({
                agent: options.agent,
                features: features,
                createEntryProperties: getTestOutputEntryProperties
            });
        } else if (instruction.name === 'test') {
            testOutputsPromise = writeOutputsToFileSystem({
                agent: options.agent,
                features: features,
                outputs: instruction.output,
                createEntryProperties: getTestOutputEntryProperties
            });
        }
        return testOutputsPromise.then(function(testOutputs) {
            var featuresMissingTestOutput = features.filter(function(feature, index) {
                return testOutputs[index] === null;
            });

            if (featuresMissingTestOutput.length) {
                if (instruction.name === 'start') {
                    return createFeatureSourcesFromFolder(
                        featuresMissingTestOutput,
                        featuresFolderPath,
                        featureTranspiler
                    ).then(function(featuresSource) {
                        return {
                            name: 'test',
                            reason: 'some-test-output-are-required',
                            detail: {
                                features: toLocalFeatures(featuresMissingTestOutput),
                                featuresSource: featuresSource
                            }
                        };
                    });
                }
                // it means that event if client just sent the tests or was just fixed
                // we are still missing some tests, there is two possible scenarios for this
                // -> client did not send all test output as he is supposed to during test instruction
                // -> some server file has been deleted inbetween
                // to prevent infinite recursion and because it not supposed to happen
                // we tell client to fail
                return {
                    name: 'fail',
                    reason: 'some-test-output-are-missing',
                    detail: {
                        features: toLocalFeatures(featuresMissingTestOutput)
                    }
                };
            }

            var featuresWithCrashedTestOutput = features.filter(function(feature, index) {
                return testOutputs[index].status === 'crashed';
            });
            if (featuresWithCrashedTestOutput.length) {
                return {
                    name: 'fail',
                    reason: 'some-test-have-crashed',
                    detail: {
                        features: toLocalFeatures(featuresWithCrashedTestOutput),
                        outputs: testOutputs.filter(function(testOutput) {
                            return testOutput.status === 'crashed';
                        })
                    }
                };
            }
            var testResults = testOutputs.map(function(testOutput) {
                return testOutput.detail;
            });
            var featuresToFix = features.filter(function(feature, index) {
                return testResults[index].status === 'invalid';
            });
            var solutions = [noSolution, polyfillSolution, transpileSolution];
            var remainingFeaturesToFix = featuresToFix;
            var solutionFeatures = solutions.map(function(solution) {
                var half = Iterable.bisect(remainingFeaturesToFix, function(feature) {
                    return solution.match(feature);
                });
                remainingFeaturesToFix = half[1];
                return half[0];
            });
            var featuresToFixWithoutSolution = solutionFeatures[0];
            if (featuresToFixWithoutSolution.length) {
                var featureHasNoSolution = function(feature) {
                    return Iterable.includes(featuresToFixWithoutSolution, feature);
                };
                return {
                    name: 'fail',
                    reason: 'some-feature-have-no-solution',
                    detail: {
                        features: toLocalFeatures(featuresToFixWithoutSolution),
                        results: testResults.filter(function(testResult, index) {
                            return featureHasNoSolution(features[index]);
                        })
                    }
                };
            }
            if (remainingFeaturesToFix.length) {
                return {
                    name: 'fail',
                    reason: 'some-solution-are-unknown',
                    detail: {
                        features: remainingFeaturesToFix.map(function(feature) {
                            return {
                                name: feature.name,
                                solution: feature.solution
                            };
                        })
                    }
                };
            }

            var isBeforeFixInstruction = instruction.name === 'start' || instruction.name === 'test';
            var fixSourcePromise;
            if (isBeforeFixInstruction) {
                fixSourcePromise = polyfillSolution.solve(solutionFeatures[1]);
            } else if (instruction.name === 'fix') {
                fixSourcePromise = Promise.resolve('');
            }

            var fixOutputsPromise;
            if (isBeforeFixInstruction || instruction.reason === 'some-fix-are-required') {
                fixOutputsPromise = readOutputsFromFileSystem({
                    agent: options.agent,
                    features: featuresToFix,
                    createEntryProperties: getFixOutputEntryProperties
                });
            } else if (instruction.reason === 'some-fix-output-are-required') {
                fixOutputsPromise = writeOutputsToFileSystem({
                    agent: options.agent,
                    features: featuresToFix,
                    outputs: instruction.output,
                    createEntryProperties: getFixOutputEntryProperties
                });
            }

            return Promise.all([
                fixSourcePromise,
                fixOutputsPromise
            ]).then(function(data) {
                var fixSource = data[0];
                var fixOutputs = data[1];

                var featuresMissingFixOutput = featuresToFix.filter(function(feature, index) {
                    return fixOutputs[index] === null;
                });
                if (featuresMissingFixOutput.length) {
                    if (isBeforeFixInstruction) {
                        /*
                        it may be the most complex thing involved here so let me explain
                        we create a transpiler adapted to required features
                        then we create a babel plugin which transpile template literals using that transpiler
                        finally we create a transpiler which uses that plugin
                        */
                        var transpiler = transpileSolution.solve(solutionFeatures[2]);
                        var plugin = createTranspiler.transformTemplateLiteralsPlugin(function(code) {
                            return transpiler.transpile(code, {
                                as: 'code',
                                filename: false,
                                sourceMaps: false,
                                // disable cache to prevent race condition with the transpiler
                                // that will use this plugin (it's the parent transpiler which is reponsible to cache)
                                cache: false
                            });
                        }, 'transpile');
                        var fixedFeatureTranspiler = createTranspiler({
                            as: 'code',
                            sourceMaps: false,
                            plugins: [
                                plugin
                            ]
                        });

                        return createFeatureSourcesFromFolder(
                            featuresMissingFixOutput,
                            featuresFolderPath,
                            fixedFeatureTranspiler
                        ).then(function(fixedFeaturesSource) {
                            return {
                                name: 'fix',
                                reason: 'some-fix-output-are-required',
                                detail: {
                                    features: toLocalFeatures(featuresMissingFixOutput),
                                    fixSource: fixSource,
                                    fixedFeaturesSource: fixedFeaturesSource
                                }
                            };
                        });
                    }
                    // it means that even if client just sent the fix
                    // we are still missing some fix result
                    // -> client did not send all fix results as he is supposed to during fix instruction
                    // -> some server file has been deleted inbetween
                    // to prevent infinite recursion and because it not supposed to happen
                    // we tell client to fail
                    return {
                        name: 'fail',
                        reason: 'some-fix-output-are-missing',
                        detail: {
                            features: toLocalFeatures(featuresMissingFixOutput)
                        }
                    };
                }
                var featuresWithCrashedFixOutput = featuresToFix.filter(function(feature, index) {
                    return fixOutputs[index].status === 'crashed';
                });
                if (featuresWithCrashedFixOutput.length) {
                    return {
                        name: 'fail',
                        reason: 'some-fix-have-crashed',
                        detail: {
                            features: toLocalFeatures(featuresWithCrashedFixOutput),
                            outputs: fixOutputs.filter(function(fixOutput) {
                                return fixOutput.status === 'crashed';
                            })
                        }
                    };
                }
                // console.log('fix outputs', fixOutputs);
                var fixResults = fixOutputs.map(function(fixOutput) {
                    return fixOutput.detail;
                });
                var featuresWithInvalidFixResult = featuresToFix.filter(function(feature, index) {
                    return fixResults[index].status === 'invalid';
                });
                if (featuresWithInvalidFixResult.length) {
                    return {
                        name: 'fail',
                        reason: 'some-solution-are-invalid',
                        detail: {
                            features: toLocalFeatures(featuresWithInvalidFixResult),
                            results: fixResults.filter(function(fixResult, index) {
                                return Iterable.includes(
                                    featuresWithInvalidFixResult,
                                    featuresToFix[index]
                                );
                            })
                        }
                    };
                }

                if (isBeforeFixInstruction && fixSource) {
                    return {
                        name: 'fix',
                        reason: 'some-fix-are-required',
                        detail: {
                            features: toLocalFeatures(featuresToFix),
                            fixSource: fixSource
                        }
                    };
                }

                return {
                    name: 'complete',
                    reason: 'all-feature-are-ok',
                    detail: {
                        // ptet différencier les features ok
                        // et les features qu'on a fix
                        features: toLocalFeatures(features)
                    }
                };
            });
        });
    });
}
function readOutputsFromFileSystem(how) {
    var features = how.features;
    var agent = how.agent;
    var outputsPromises = features.map(function(feature) {
        return readOutputFromFileSystem(feature);
    });
    return Promise.all(outputsPromises);

    function readOutputFromFileSystem(feature) {
        return getFeatureAgentCache(feature, agent).then(function(featureAgentCache) {
            var entryProperties = how.createEntryProperties(feature);
            return featureAgentCache.entry(entryProperties);
        }).then(function(entry) {
            return entry.read();
        }).then(function(data) {
            if (data.valid) {
                return data.value;
            }
            return null;
        });
    }
}
function writeOutputsToFileSystem(how) {
    var features = how.features;
    var agent = how.agent;
    var outputs = how.outputs;
    var outputsPromises = outputs.map(function(output, index) {
        if (output === null) {
            return Promise.resolve(null);
        }
        return writeOutputToFileSystem(features[index], output);
    });
    return Promise.all(outputsPromises);

    function writeOutputToFileSystem(feature, output) {
        return getFeatureAgentCache(feature, agent).then(function(featureAgentCache) {
            var entryProperties = how.createEntryProperties(feature);
            return featureAgentCache.entry(entryProperties);
        }).then(function(entry) {
            return entry.write(output);
        });
    }
}
function getFeatureAgentCache(feature, agent) {
    var featureCacheFolderPath = featuresFolderPath + '/' + feature.name + '/.cache';
    var featureCache = store.fileSystemCache(featureCacheFolderPath);
    return featureCache.match({
        agent: agent
    });
}
function getRequiredFeatures(names) {
    return getFeatures().then(filterRequiredFeatures);

    function filterRequiredFeatures(features) {
        var featureHalf = jsenv.Iterable.bisect(features, function(feature) {
            var required = isRequired(feature);
            return required;
        });
        var featureToEnable = featureHalf[0];
        var featureToDisable = featureHalf[1];

        featureToDisable.forEach(function(feature) {
            feature.disable();
        });
        featureToEnable.forEach(function(feature) {
            feature.enable();
        });

        var enabledFeatures = features.filter(function(feature) {
            return feature.isEnabled();
        });
        return enabledFeatures.sort();
    }
    function isRequired(feature) {
        return jsenv.Iterable.some(names, function(name) {
            return feature.match(name);
        });
    }
}
function getFeatures() {
    return getFileSystemFeatures();

    function getFileSystemFeatures() {
        return getFeatureSourcesFromFileSystem().then(
            createFeaturesFromSource
        );

        function createFeaturesFromSource(featuresSource) {
            // console.log('the source', featuresSource);
            var features;
            try {
                features = eval(featuresSource); // eslint-disable-line no-eval
                return features;
            } catch (e) {
                // console.error('eval error in', featuresSource);
                throw e;
            }
        }
    }
}
var featuresStore = store.memoryEntry();
var getFeatureSourcesFromFileSystem = memoize.async(createFeatureSourcesFromFileSystem, featuresStore);
function createFeatureSourcesFromFileSystem() {
    return recursivelyReadFolderFeatures(featuresFolderPath).then(function(features) {
        return createFeatureSourcesFromFolder(features, featuresFolderPath, featureTranspiler);
    });

    function recursivelyReadFolderFeatures(path) {
        var features = [];
        return readFolderFeatures(null).then(function() {
            return features;
        });

        function readFolderFeatures(parentFeature) {
            var featureFolderPath;
            if (parentFeature) {
                featureFolderPath = path + '/' + parentFeature.name;
            } else {
                featureFolderPath = path;
            }

            return readFolder(featureFolderPath).then(function(ressourceNames) {
                var ressourcePaths = ressourceNames.map(function(name) {
                    return featureFolderPath + '/' + name;
                });
                var ressourcesPromise = ressourcePaths.map(function(ressourcePath, index) {
                    return fsAsync('stat', ressourcePath).then(function(stat) {
                        var ressourceName = ressourceNames[index];
                        if (stat.isDirectory()) {
                            if (ressourceName[0].match(/[a-z]/)) {
                                var featureName;
                                if (parentFeature) {
                                    featureName = parentFeature.name + '/' + ressourceName;
                                } else {
                                    featureName = ressourceName;
                                }
                                var feature = jsenv.createFeature(featureName);

                                features.push(feature);
                                return readFolderFeatures(feature);
                            }
                        }
                        return Promise.resolve();
                    });
                });
                return Promise.all(ressourcesPromise);
            });
        }
        function readFolder(path) {
            return fsAsync('readdir', path);
        }
    }
}
function createFeatureSourcesFromFolder(features, folderPath, transpiler) {
    var paths = features.map(function(feature) {
        return folderPath + '/' + feature.name + '/feature.js';
    });

    return getSources(paths).then(createSources);

    function getSources(paths) {
        return Promise.all(paths.map(function(path) {
            return fsAsync('stat', path).then(
                function(stat) {
                    if (stat.isFile()) {
                        return transpiler.transpileFile(path);
                    }
                },
                function(e) {
                    if (e && e.code === 'ENOENT') {
                        return '';
                    }
                    return Promise.reject(e);
                }
            );
        }));
    }
    function createSources(sources) {
        var registerFeaturesHead = 'jsenv.registerFeatures(function(registerFeature, transpile) {';
        var registerFeaturesBody = sources.map(function(source, index) {
            return createSource(features[index], sources[index]);
        });
        var registerFeaturesFoot = '});';

        return (
            '\n' +
            registerFeaturesHead +
            '\n\t' +
            registerFeaturesBody.join('\n\t\n\t') +
            '\n' +
            registerFeaturesFoot +
            '\n'
        );
    }
    function createSource(feature, featureCode) {
        var featureNameSource = "'" + feature.name + "'";
        var featurePropertiesSource = '';
        if (featureCode) {
            featurePropertiesSource += 'function(feature, parent, dependency, expose) {\n\t';
            featurePropertiesSource += featureCode;
            featurePropertiesSource += '\n}';
        } else {
            featurePropertiesSource = 'null';
        }

        return 'registerFeature(' + featureNameSource + ', ' + featurePropertiesSource + ');';
    }
}

module.exports = {
    getDistantInstruction: function(instruction, complete) {
        getNextInstruction(instruction).then(
            complete,
            function(value) {
                complete({
                    name: 'crash',
                    reason: 'unexpected-rejection',
                    detail: value
                });
            }
        );
    }
};

// var firstInstruction = {
//     name: 'start',
//     output: {
//         features: [
//             'const/scoped'
//         ]
//     }
// };
// getDistantInstruction(firstInstruction).then(function(instruction) {
//     console.log('instruction', instruction);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

// var createAgent = (function() {
//     var Agent = function(name) {
//         this.name = name;
//     };
//     Agent.prototype = {
//         constructor: Agent,

//         createImplementation: function() {
//             var implementation = createImplementation.apply(null, arguments);
//             return implementation;
//         }
//     };
//     function createAgent(name) {
//         return new Agent(name);
//     }

//     var Implementation = function(featureNames) {
//         this.featureNames = featureNames;
//     };
//     Implementation.prototype = {
//         constructor: Implementation
//     };

//     function createImplementation() {
//         return new Implementation(arguments);
//     }

//     return createAgent;
// })();
