/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

*/

require('../jsenv.js');
var fsAsync = require('../fs-async.js');
var featuresFolderPath = require('path').resolve(__dirname, './').replace(/\\/g, '/');
var featureTranspiler = require('./transpiler.js')({
    cache: true,
    plugins: [
        'transform-es2015-template-literals'
    ]
});

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

    return function() {
        jsenv.features = [];
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
    };
})();

readAllFeatures().then(function(features) {
    console.log('feture 0', features[0]);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

module.exports = readAllFeatures;

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
