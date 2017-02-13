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
var readAllFeatures = (function() {
    function readFileSystemFolder(feature) {
        var path = featuresFolderPath;
        if (feature.name) {
            path += '/' + feature.name;
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
                                transform: function(code) {
                                    return '(function (transpile) {\n' + code + '\n})';
                                }
                            }).then(function(code) {
                                var featureConstructor = eval(code); // eslint-disable-line no-eval
                                featureConstructor.call(feature, jsenv.transpile);
                            });
                        }
                    } else if (stat.isDirectory()) {
                        if (ressourceName[0].match(/[a-z]/)) {
                            var dependentFeatureName;
                            if (feature.name) {
                                dependentFeatureName = feature.name + '/' + ressourceName;
                            } else {
                                dependentFeatureName = ressourceName;
                            }
                            var dependentFeature = jsenv.createFeature(dependentFeatureName);
                            dependentFeature.addDependency(feature, {as: 'parent'});
                            return readFileSystemFolder(dependentFeature);
                        }
                    }
                    return Promise.resolve();
                });
            });
            return Promise.all(ressourcesPromise);
        });
    }

    function createFeatures() {
        jsenv.features = []; // ceci peut cause un problème
        // de race condition
        // il faut absolument éviter ça c'est nul nul nul
        // on verra comment plus tard
        var features = jsenv.features;
        var rootFeature = jsenv.createFeature('');
        jsenv.Iterable.remove(features, rootFeature);

        return readFileSystemFolder(rootFeature).then(function() {
            rootFeature.dependents.forEach(function(feature) {
                jsenv.Iterable.remove(feature.dependencies, rootFeature);
                delete feature.parent;
            });

            return features;
        });
    }

    return memoize.async(createFeatures, featuresStore);
})();

function getFilteredFeatures(names) {
    return readAllFeatures().then(function(features) {
        var featureHalf = jsenv.Iterable.bisect(features, function(feature) {
            return names.some(function(name) {
                return feature.match(name);
            });
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

function createFeaturesTests(options) {
    var featureNames = options.features;
    var agent = options.agent || 'Firefox/50.0';

    return getFilteredFeatures(featureNames).then(function(features) {
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
            // que je n'ai pluas qu'à tester en utilisant l'api de jsenv
            console.log(missingTestResultFeatures.length, 'test to run');
        });
    });
}

createFeaturesTests({
    features: [
        'const',
        'let'
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
    createFeaturesTests: createFeaturesTests
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
