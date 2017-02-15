/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

*/

require('../jsenv.js');
var Iterable = jsenv.Iterable;
var fsAsync = require('../fs-async.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var featuresFolderPath = require('path').resolve(__dirname, './').replace(/\\/g, '/');
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

function getEnsureImplementationInstruction(adaptOptions) {
    var options = {
        agent: 'Firefox/50.0'
    };
    jsenv.assign(options, adaptOptions || {});

    function delegate(optionName, getter) {
        return memoize.async(getter, store.objectEntry(options, optionName))();
    }

    return delegate('featureNames', function() {
        return getRequiredFeatures(options.features).then(function(features) {
            return features.map(function(feature) {
                return feature.name;
            });
        });
    }).then(function(featureNames) {
        var testOutputs = options.testOutputs || [];
        return loadMissingOutputsFromFileSystem();

        function loadMissingOutputsFromFileSystem() {
            var outputsPromises = featureNames.map(function(featureName, index) {
                if (index in testOutputs && testOutputs[index] !== null) {
                    return testOutputs[index];
                }
                return loadFileSystemOutput(featureName);
            });
            return Promise.all(outputsPromises);

            function loadFileSystemOutput(featureName) {
                return getFeatureAgentCache(featureName, options.agent).then(function(featureAgentCache) {
                    return featureAgentCache.entry({
                        name: 'test-output.json',
                        sources: [
                            {
                                path: featuresFolderPath + '/' + featureName + '/feature.js',
                                strategy: 'eTag'
                            }
                        ]
                    });
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
    }).then(function(testOutputs) {
        var featureNames = options.featureNames;
        var featureNamesMissingOutput = featureNames.filter(function(featureName, index) {
            return testOutputs[index] === null;
        });

        if (featureNamesMissingOutput.length) {
            return createFeatureSourcesFromFolder(
                featureNamesMissingOutput,
                featuresFolderPath,
                featureTranspiler
            ).then(function(featuresSource) {
                return {
                    name: 'scan',
                    input: {
                        featuresSource: featuresSource
                    }
                };
            });
        }
        // on a tous les résultat
        var crashedOutputIndex = Iterable.findIndex(testOutputs, function(testOutput) {
            return testOutput.status === 'crashed';
        });
        if (crashedOutputIndex > -1) {
            return {
                status: 'crashed',
                detail: {
                    featureName: featureNames[crashedOutputIndex],
                    crashed: testOutputs[crashedOutputIndex]
                }
            };
        }

        return Promise.all([
            getFixSource(testOutputs),
            getFixState(options)
        ]).then(function(data) {
            var fixSource = data[0];
            var fixState = data[1];

            if (fixState.status === 'crashed') {
                return {
                    name: 'crash',
                    input: fixState.detail.crashed
                };
            }
            if (fixState.status === 'completed') {
                // var outputs = fixState.detail.outputs;
                var missingFeatureNames = fixState.detail.missingFeatureNames;
                if (missingFeatureNames.length) {
                    var fixedFeatureTranspiler = createTranspiler({
                        // faut check les solutions et récupérer
                        // le config des plugins
                        // en plus il faut aussi utiliser le plugin spécial
                    });

                    return createFeatureSourcesFromFolder(
                        missingFeatureNames,
                        featuresFolderPath,
                        fixedFeatureTranspiler
                    ).then(function(fixedFeaturesSource) {
                        return {
                            name: 'fix+test',
                            input: {
                                fixSource: fixSource,
                                fixedFeaturesSource: fixedFeaturesSource
                            }
                        };
                    });
                }

                return {
                    name: 'fix',
                    input: {
                        fixSource: fixSource
                    }
                };
            }
        });
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
        return enabledFeatures;
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
            return eval(featuresSource); // eslint-disable-line no-eval
        }
    }
}
var featuresStore = store.memoryEntry();
var getFeatureSourcesFromFileSystem = memoize.async(createFeatureSourcesFromFileSystem, featuresStore);
function createFeatureSourcesFromFileSystem() {
    return recursivelyReadFolderFeatureNames(featuresFolderPath).then(function(featureNames) {
        return createFeatureSourcesFromFolder(featureNames, featuresFolderPath, featureTranspiler);
    });

    function recursivelyReadFolderFeatureNames(path) {
        var featureNames = [];
        return readFolderFeatureNames(null).then(function() {
            return featureNames;
        });

        function readFolderFeatureNames(parentFeatureName) {
            var featureFolderPath;
            if (parentFeatureName) {
                featureFolderPath = path + '/' + parentFeatureName;
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
                                if (parentFeatureName) {
                                    featureName = parentFeatureName + '/' + ressourceName;
                                } else {
                                    featureName = ressourceName;
                                }

                                featureNames.push(featureName);
                                return readFolderFeatureNames(featureName);
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
function createFeatureSourcesFromFolder(featureNames, folderPath, transpiler) {
    var paths = featureNames.map(function(featureName) {
        return folderPath + '/' + featureName + '/feature.js';
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
            return createSource(featureNames[index], sources[index]);
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
    function createSource(featureName, featureCode) {
        var featureNameSource = "'" + featureName + "'";
        var featurePropertiesSource = '';
        if (featureCode) {
            featurePropertiesSource += 'function(feature) {\n\t';
            featurePropertiesSource += featureCode;
            featurePropertiesSource += '\n}';
        } else {
            featurePropertiesSource = 'function() {}';
        }

        return 'registerFeature(' + featureNameSource + ', ' + featurePropertiesSource + ');';
    }
}
function getFeatureAgentCache(featureName, agent) {
    var featurePath = featuresFolderPath + '/' + featureName;
    var featureCache = store.fileSystemCache(featurePath);
    return featureCache.match({
        agent: agent
    });
}
function getFixState(agent, features) {
    return getFeaturesFixOutput(agent, features).then(function(outputs) {
        var missingFeatureNames = features.filter(function(feature, index) {
            return outputs[index] === null;
        }).map(function(feature) {
            return feature.name;
        });
        var crashedOutput = Iterable.find(outputs, function(output) {
            return output && output.status === 'crashed';
        });
        if (crashedOutput) {
            return {
                status: 'crashed',
                detail: {
                    outputs: outputs,
                    crashed: crashedOutput,
                    missingFeatureNames: missingFeatureNames
                }
            };
        }
        return {
            status: 'completed',
            detail: {
                outputs: outputs,
                missingFeatureNames: missingFeatureNames
            }
        };
    });

    function getFeaturesFixOutput(agent, features) {
        var outputsPromises = features.map(function(feature) {
            return createFixOutputPromise(feature);
        });
        return Promise.all(outputsPromises);

        function createFixOutputPromise(feature) {
            return getFeatureAgentCache(feature, agent).then(function(featureAgentCache) {
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

                return featureAgentCache.entry({
                    name: 'fix-output.json',
                    sources: sources
                });
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
}
function getFixSource(/* featureTestOutputs */) {
    // j'ai le résultat de TOUS les test, je peux donc passer en mode fix dès maintenant
    // le mode fix consistera à récup les solutions
    // et à les condenser en un polyfill et des options de transpilations
    // en parallèle il s'agit aussi de produire une version
    // fixé des tests (on transpile le code)
    return '';
}
// function storeTestResults(agent, testResults) {
    // sauvegarde tout ces résultat en cache
    // et récupère ce qu'on doit faire ensuite
    // donc en gros comme on a tout les résultat on peut repartir "direct"" du bout de code
    // qui récupère ce qui a besoin d'être fixé vu qu'on a les résultats
    // en fait c'est pas si simple puisque on peut avoir des résultats partiel
    // autant repartir du départ tant pis
// }
// function storeFixResult(agent, fixResult)

getEnsureImplementationInstruction({
    features: [
        'const/scoped'
    ]
}).then(function(instruction) {
    console.log('instruction', instruction);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

module.exports = {
    getRequiredFeatures: getRequiredFeatures,
    getFeatures: getFeatures
};

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
