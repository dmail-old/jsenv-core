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
var featureTranspiler = require('./transpiler.js')({
    cache: true,
    plugins: [
        'transform-es2015-template-literals'
    ]
});

function getFeaturesTests(options) {
    var featureNames = options.features;
    var agent = options.agent || 'Firefox/50.0';

    return getRequiredFeatures(featureNames).then(function(features) {
        // pour chaque feature regarde si on connait
        // son résultat pour cet agent

        function getFeatureAgentCache(feature) {
            var featurePath = featuresFolderPath + '/' + feature.name;
            var featureCache = store.fileSystemCache(featurePath);
            return featureCache.match({
                agent: agent
            });
        }

        return Promise.all(features.map(function(feature) {
            return getFeatureAgentCache(feature).then(function(featureAgentCache) {
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
        })).then(function(testResults) {
            var hasTestResultOfAllFeatures = testResults.every(function(result) {
                return Boolean(result);
            });
            if (hasTestResultOfAllFeatures) {
                // j'ai le résultat de TOUS les test, je peux donc passer en mode fix dès maintenant
                console.log('got to fix step');
            }
            var missingTestResultFeatures = features.filter(function(feature, index) {
                return testResults[index] === null;
            });
            // pour toutes ces features je dois passer des tests
            // l'idée c'est donc d'avoir une fonction genre buildFeatureTests
            // idéalement lorsque j'eval ça je devrait récup une liste des features
            // que je n'ai plus qu'à tester en utilisant l'api de jsenv
            // sauf que pour ça j'ai besoin du code dans array/feature.js
            // ici je n'y ai plus accès mais je peux retrouve où le fichier est censé être
            // lire son contenu, et générer à nouveau du js capable d'enregistrer une liste de features
            // nan mais c'est bon maintenant je n'aurais qu'à faire
            // createFeatureSourcesFromFolder(missingTestResultFeatures) en gros
            console.log(missingTestResultFeatures.length, 'test to run');
        });
    });
}
function getRequiredFeatures(names) {
    return getFeatures().then(function(features) {
        var isRequired = function(feature) {
            return jsenv.Iterable.some(names, function(name) {
                return feature.match(name);
            });
        };
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
    });
}
function getFeatures() {
    return getFileSystemFeatures();
}
function getFileSystemFeatures() {
    return getFeatureSourcesFromFileSystem().then(function(featuresSource) {
        return eval(featuresSource); // eslint-disable-line no-eval
    });
}
var featuresStore = store.memoryEntry();
var getFeatureSourcesFromFileSystem = memoize.async(createFeatureSourcesFromFileSystem, featuresStore);
function createFeatureSourcesFromFileSystem() {
    return recursivelyReadFolderFeatureNames(featuresFolderPath).then(function(featureNames) {
        return createFeatureSourcesFromFolder(featureNames, featuresFolderPath);
    });
}
function recursivelyReadFolderFeatureNames(path) {
    var featureNames = [];

    function readFolder(path) {
        return fsAsync('readdir', path);
    }

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

    return readFolderFeatureNames(null).then(function() {
        return featureNames;
    });
}
function createFeatureSourcesFromFolder(featureNames, folderPath) {
    var paths = featureNames.map(function(featureName) {
        return folderPath + '/' + featureName + '/feature.js';
    });

    return getSources(paths).then(createSources);

    function getSources(paths) {
        return Promise.all(paths.map(function(path) {
            return fsAsync('stat', path).then(
                function(stat) {
                    if (stat.isFile()) {
                        return featureTranspiler.transpileFile(path, {
                            sourceMaps: false,
                            filename: false,
                            transform: function(code) {
                                return code;
                            }
                        });
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

getFeaturesTests({
    features: [
        'const/scoped'
    ]
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

// readAllFeatures().then(function(features) {
//     console.log('feture 0', features[0]);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

module.exports = {
    getFeatures: getFeatures,
    getRequiredFeatures: getRequiredFeatures,
    getFeaturesTests: getFeaturesTests
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
