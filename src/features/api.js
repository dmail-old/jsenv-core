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

// maintenant, ça pourrait être plutôt cool d'obtenir une sorte de js qu'on a plus qu'à évaluer
// pour obtenir une liste des features
// var features = eval(createFeatures())
// ensuite on aurait plus qu'à check si on a déjà un résultat pour chaque feature
// toutes celles n'ayant pas de résultat doivent être testées
// et on doit alors crée encore un autre code qu'on doit eval
// genre createFeatureTests(...names)
// ou tout simplement on commence par createFeatureTests
// si aucun tets a run alors createFeaturesPolyfill()
// et en parallèle createFeaturesFixedTests()
// si aucun createFeaturesFixedTests necéssaire on retourne que c'est bon
// sinon on retourne les tests qu'on doit faire

var featuresStore = store.memoryEntry();
var getFeaturesSource = (function() {
    function createFeaturesSource() {
        var featureEntries = [];

        function readFileSystemFolder(featureName) {
            var path = featuresFolderPath;
            if (featureName) {
                path += '/' + featureName;
            }

            var featureEntry = {
                name: featureName,
                code: ''
            };
            if (featureName) {
                featureEntries.push(featureEntry);
            }

            return fsAsync('readdir', path).then(function(ressourceNames) {
                var ressourcePaths = ressourceNames.map(function(name) {
                    return path + '/' + name;
                });
                var ressourcesPromise = ressourcePaths.map(function(ressourcePath, index) {
                    return fsAsync('stat', ressourcePath).then(function(stat) {
                        var ressourceName = ressourceNames[index];
                        if (stat.isFile()) {
                            if (ressourceName === 'feature.js') {
                                return featureTranspiler.transpileFile(ressourcePath, {
                                    sourceMaps: false,
                                    filename: false,
                                    transform: function(code) {
                                        return code;
                                    }
                                }).then(function(code) {
                                    featureEntry.code = code;
                                });
                            }
                        } else if (stat.isDirectory()) {
                            if (ressourceName[0].match(/[a-z]/)) {
                                var dependentFeatureName;
                                if (featureName) {
                                    dependentFeatureName = featureName + '/' + ressourceName;
                                } else {
                                    dependentFeatureName = ressourceName;
                                }

                                return readFileSystemFolder(dependentFeatureName);
                            }
                        }
                        return Promise.resolve();
                    });
                });
                return Promise.all(ressourcesPromise);
            });
        }

        function convertEntries() {
            var registerFeaturesHead = 'jsenv.registerFeatures(function(registerFeature, transpile) {';
            var registerFeaturesBody = featureEntries.map(function(featureEntry) {
                var featureNameSource = "'" + featureEntry.name + "'";
                var featurePropertiesSource = '';
                if (featureEntry.code) {
                    featurePropertiesSource += 'function(feature) {\n\t';
                    featurePropertiesSource += featureEntry.code;
                    featurePropertiesSource += '\n}';
                } else {
                    featurePropertiesSource = 'function() {}';
                }

                return 'registerFeature(' + featureNameSource + ', ' + featurePropertiesSource + ');';
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

        return readFileSystemFolder().then(convertEntries);
    }

    return memoize.async(createFeaturesSource, featuresStore);
})();
function getFeatures() {
    return getFeaturesSource().then(function(featuresSource) {
        return eval(featuresSource); // eslint-disable-line no-eval
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
            // en gros je pense qu'il "suffit"
            console.log(missingTestResultFeatures.length, 'test to run');
        });
    });
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
    getFeaturesSource: getFeaturesSource,
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
