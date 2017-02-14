/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

*/

require('../jsenv.js');
var fsAsync = require('../fs-async.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var featuresFolderPath = require('path').resolve(__dirname, './').replace(/\\/g, '/');
var createTranspiler = require('./transpiler.js');
var featureTranspiler = createTranspiler({
    cache: true,
    filename: false,
    sourceMaps: false,
    plugins: [
        'transform-es2015-template-literals'
    ]
});

function getEnsureImplementationInstruction(options) {
    var featureNames = options.features;
    var agent = options.agent || 'Firefox/50.0';

    return getRequiredFeatures(featureNames).then(function(features) {
        return getTestState(agent, features).then(function(testState) {
            if (testState.name === 'partial') {
                var untestedFeatureNames = testState.value;
                return createFeatureSourcesFromFolder(
                    untestedFeatureNames,
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
            } else if (testState.name === 'completed') {
                var testResults = testState.value;
                return Promise.all([
                    getFixSource(testResults, features),
                    getIntegrationState(agent, features)
                ]).then(function(data) {
                    var fixSource = data[0];
                    var integrationState = data[1];

                    if (integrationState.name === 'partial') {
                        var untestedFeatureNames = integrationState.value;
                        var fixedFeatureTranspiler = createTranspiler({
                            // faut check les solutions et récupérer
                            // le config des plugins
                            // en plus il faut aussi utiliser le plugin spécial
                        });

                        return createFeatureSourcesFromFolder(
                            untestedFeatureNames,
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
                });
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
function getTestState(agent, features) {
    return getFeaturesTestResults(agent, features).then(function(testResults) {
        var hasTestResultOfAllFeatures = testResults.every(function(result) {
            return Boolean(result);
        });
        if (hasTestResultOfAllFeatures) {
            return {
                name: 'complete',
                value: testResults
            };
        }
        var untestedFeatures = features.filter(function(feature, index) {
            return testResults[index] === null;
        });
        var untestedFeatureNames = untestedFeatures.map(function(feature) {
            return feature.name;
        });
        return {
            name: 'partial',
            value: untestedFeatureNames
        };
    });

    function getFeaturesTestResults(agent, features) {
        var resultsPromises = features.map(function(feature) {
            return createResultPromise(feature);
        });
        return Promise.all(resultsPromises);

        function createResultPromise(feature) {
            return getFeatureAgentCache(feature, agent).then(function(featureAgentCache) {
                return featureAgentCache.entry({
                    name: 'test-result.json',
                    sources: [
                        {
                            path: featuresFolderPath + '/' + feature.name + '/feature.js',
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
}
function getFeatureAgentCache(feature, agent) {
    var featurePath = featuresFolderPath + '/' + feature.name;
    var featureCache = store.fileSystemCache(featurePath);
    return featureCache.match({
        agent: agent
    });
}
function getIntegrationState(agent, features) {
    return getFeaturesIntegrationResults(agent, features).then(function(integrationResults) {
        var hasResultOfAllFeatures = integrationResults.every(function(result) {
            return Boolean(result);
        });
        if (hasResultOfAllFeatures) {
            return {
                valid: true,
                value: integrationResults
            };
        }
        var untestedFeatures = features.filter(function(feature, index) {
            return integrationResults[index] === null;
        });
        var untestedFeatureNames = untestedFeatures.map(function(feature) {
            return feature.name;
        });
        return {
            valid: false,
            value: untestedFeatureNames
        };
    });

    function getFeaturesIntegrationResults(agent, features) {
        var resultsPromises = features.map(function(feature) {
            return createIntegrationResultPromise(feature);
        });
        return Promise.all(resultsPromises);

        function createIntegrationResultPromise(feature) {
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
                    name: 'integration-result.json',
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
function getFixSource() {
    // j'ai le résultat de TOUS les test, je peux donc passer en mode fix dès maintenant
    // le mode fix consistera à récup les solutions
    // et à les condenser en un polyfill et des options de transpilations
    // en parallèle il s'agit aussi de produire une version
    // fixé des tests (on transpile le code)
    return '';
}

// function getFixState(agent, featureNames)
// on on utilisera un fix-result.json qu'on met avec test-result.json et integration-result.json

// function storeTestResults(agent, featureNames, testResults)
// sauvegarde tout ces résultat en cache
// et récupère ce qu'on doit faire ensuite
// donc en gros comme on a tout les résultat on peut repartir "direct"" du bout de code
// qui récupère ce qui a besoin d'être fixé vu qu'on a les résultats
// en fait c'est pas si simple puisque on peut avoir des résultats partiel
// autant repartir du départ tant pis

// function storeFixAndIntegrationResult(agent, fixResult, integrationResult)

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
