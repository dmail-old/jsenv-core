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
        sources: sources
    };
    return entryProperties;
}

function getNextAdaptInstruction(instruction) {
    var options = {
        agent: 'Firefox/50.0'
    };
    jsenv.assign(options, instruction.input);

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
                            reason: 'missing-some-test-output',
                            detail: {
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
                    reason: 'unexpected-missing-some-test-output',
                    detail: {
                        features: featuresMissingTestOutput.map(function(feature) {
                            return {name: feature.name};
                        })
                    }
                };
            }
            var crashedTestOutputIndex = Iterable.findIndex(testOutputs, function(testOutput) {
                return testOutput.status === 'crashed';
            });
            if (crashedTestOutputIndex > -1) {
                return {
                    name: 'fail',
                    reason: 'test-crash',
                    detail: {
                        feature: {
                            name: features[crashedTestOutputIndex].name
                        },
                        result: testOutputs[crashedTestOutputIndex]
                    }
                };
            }

            var fixSourcePromise = getFixSource(options);
            var fixOutputsPromise;
            if (instruction.name === 'test') {
                fixOutputsPromise = readOutputsFromFileSystem({
                    agent: options.agent,
                    features: features,
                    createEntryProperties: getFixOutputEntryProperties
                });
            } else if (instruction.name === 'fix') {
                fixOutputsPromise = writeOutputsToFileSystem({
                    agent: options.agent,
                    features: features,
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

                var featuresMissingFixOutput = features.filter(function(feature, index) {
                    return fixOutputs[index] === null;
                });
                if (featuresMissingFixOutput.length) {
                    if (instruction.name === 'start' && instruction.name === 'test') {
                        var fixedFeatureTranspiler = createTranspiler({
                            // faut check les solutions et récupérer
                            // la config des plugins
                            // en plus il faut aussi utiliser le plugin spécial
                        });

                        return createFeatureSourcesFromFolder(
                            featuresMissingFixOutput,
                            featuresFolderPath,
                            fixedFeatureTranspiler
                        ).then(function(fixedFeaturesSource) {
                            return {
                                name: 'fix',
                                reason: 'missing-some-fix-output',
                                detail: {
                                    fixSource: fixSource,
                                    fixedFeaturesSource: fixedFeaturesSource
                                }
                            };
                        });
                    }
                    // it means that event if client just sent the fix
                    // we are still missing some fix result
                    // -> client did not send all fix results as he is supposed to during fix instruction
                    // -> some server file has been deleted inbetween
                    // to prevent infinite recursion and because it not supposed to happen
                    // we tell client to fail
                    return {
                        name: 'fail',
                        reason: 'unexpected-missing-some-fix-output',
                        detail: {
                            features: featuresMissingFixOutput.map(function(feature) {
                                return {name: feature.name};
                            })
                        }
                    };
                }
                var crashedFixOutputIndex = Iterable.findIndex(fixOutputs, function(fixOutput) {
                    return fixOutput.status === 'crashed';
                });
                if (crashedFixOutputIndex > -1) {
                    return {
                        name: 'fail',
                        reason: 'fix-crash',
                        detail: {
                            feature: {
                                name: features[crashedFixOutputIndex].name
                            },
                            output: fixOutputs[crashedFixOutputIndex]
                        }
                    };
                }
                return {
                    name: 'fix',
                    reason: 'missing-fix',
                    detail: {
                        fixSource: fixSource
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
    var featurePath = featuresFolderPath + '/' + feature.name;
    var featureCache = store.fileSystemCache(featurePath);
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
            var features;
            try {
                features = eval(featuresSource); // eslint-disable-line no-eval
                return features;
            } catch (e) {
                console.error('eval error in', featuresSource, e, e.stack);
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
            featurePropertiesSource += 'function(feature) {\n\t';
            featurePropertiesSource += featureCode;
            featurePropertiesSource += '\n}';
        } else {
            featurePropertiesSource = 'function() {}';
        }

        return 'registerFeature(' + featureNameSource + ', ' + featurePropertiesSource + ');';
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

var firstInstruction = {
    name: 'start',
    input: {
        features: [
            'const/scoped'
        ]
    }
};
getNextAdaptInstruction(firstInstruction).then(function(instruction) {
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
