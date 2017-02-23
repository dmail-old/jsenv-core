/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- ne pas lire toutes le filesystem puis générer une entries en créant un eval géant
au lieu de ça ->
on sait ou sont les features, on les lit un par un

- test-output.json
missing
-> renvoyer la solution sinon "espérer" que ça marcheras
crashed
-> même chose qu'au dessus
failed
-> si une solution, regarde fix-output.jsn
    missing
    -> renvoyer la solution et espérer que ça passe
    crashed
    -> même chose qu'au dessus
    failed
    -> renvoyer un code d'erreur comme quoi la solution pour cette feature ne marche pas
    completed
    -> renvoyer la solution
sinon renvoyer un code d'erreur comme quoi la feature n'a pas de solution

dans les cas "espérer" que ça marchera, le client pourra émétter un warning genre
cette feature pourrait ne pas marcher puisque:
    j'applique la solution sans tester OU je n'ai pas testé

- chaque polyfill pourrait lui aussi définir des dépendances
pour le moment comme si le polyfill était toujours standalone
ou que son implémentation ne requiert rien de spécial d'autre que la feature elle-même
comme on peut le voir dans corjs il y a souvent besoin du résultat d'autre polyfill pour
fournir celui qu'on veut, ignorons ça pour le moment

*/

require('../jsenv.js');
var path = require('path');
var Iterable = jsenv.Iterable;
var Thenable = jsenv.Thenable;
// var Predicate = jsenv.Predicate;
var Agent = require('../agent/agent.js');
var fsAsync = require('../fs-async.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var uneval = require('../uneval.js');
var rootFolder = path.resolve(__dirname, '../..').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var featuresFolderPath = rootFolder + '/src/features';
var corejsCacheFolder = cacheFolder + '/corejs';
var createTranspiler = require('./transpiler.js');

var api = {};

api.listFeatureNames = function() {
    return readAllFeatureNamesOnFileSystem();
};
function readAllFeatureNamesOnFileSystem() {
    function recursivelyReadFolderFeaturesName(path) {
        var featureNames = [];

        function readFolderFeaturesName(parentName) {
            var featureFolderPath;
            if (parentName) {
                featureFolderPath = path + '/' + parentName;
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
                                if (parentName) {
                                    featureName = parentName + '/' + ressourceName;
                                } else {
                                    featureName = ressourceName;
                                }

                                featureNames.push(featureName);
                                return readFolderFeaturesName(featureName);
                            }
                        }
                    });
                });
                return Thenable.all(ressourcesPromise);
            });
        }
        function readFolder(path) {
            return fsAsync('readdir', path);
        }

        return readFolderFeaturesName(null).then(function() {
            return featureNames;
        });
    }

    return recursivelyReadFolderFeaturesName(featuresFolderPath);
}
// api.listFeatureNames().then(function(names) {
//     console.log('names', names);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

api.getAllFeature = function() {
    var featureNames = Array.prototype.slice.call(arguments);
    var registerer = jsenv.createFeatureRegisterer();
    var transpiler = createFeatureTranspiler();

    function registerAll(names) {
        var namesAndAncestorsNames = Iterable.reduce(names, function(previous, name) {
            return previous.concat(splitFeatureName(name));
        }, []);
        var uniqNamesToRegister = Iterable.uniq(namesAndAncestorsNames);

        return Thenable.all(uniqNamesToRegister.map(register));
    }
    function register(name) {
        if (registerer.has(name) === false) {
            return readFeatureFromFileSystem(name, transpiler).then(function(body) {
                var constructor = createFeatureConstructorFromBodySource(body);
                var feature = registerer.add(name, constructor);
                feature.propertiesConstructor = constructor;

                var possiblyUnhandledDependencies;
                if (feature.parent) {
                    possiblyUnhandledDependencies = feature.dependencies.slice(1);
                } else {
                    possiblyUnhandledDependencies = feature.dependencies;
                }
                return registerAll(possiblyUnhandledDependencies.map(function(dependency) {
                    return dependency.name;
                }));
            });
        }
    }

    registerer.open();
    return registerAll(featureNames).then(function() {
        return registerer.close();
    }).then(function(features) {
        return featureNames.map(function(name) {
            return Iterable.find(features, function(feature) {
                return feature.name === name;
            });
        });
    });
};
function splitFeatureName(featureName) {
    var parts = featureName.split('/');
    var names = parts.map(function(name, index) {
        return parts.slice(0, index + 1).join('/');
    });
    return names;
}
function createFeatureTranspiler() {
    return createTranspiler({
        cache: true,
        cacheMode: 'default',
        filename: false,
        sourceMaps: false,
        plugins: [
            'transform-es2015-template-literals'
        ]
    });
}
function readFeatureFromFileSystem(featureName, transpiler) {
    var featureFolderPath = featuresFolderPath + '/' + featureName;

    return fsAsync('stat', featureFolderPath).then(
        function(stat) {
            if (stat.isDirectory() === false) {
                throw new Error('directory expected at ' + featureFolderPath);
            }
            return readFeatureSourceFromFileSystem(
                featureFolderPath + '/feature.js',
                transpiler
            );
        },
        function(e) {
            if (e && e.code === 'ENOENT') {
                throw new Error('the is no feature named ' + featureName);
            }
            return Thenable.reject(e);
        }
    );
}
function readFeatureSourceFromFileSystem(path, transpiler) {
    return fsAsync('stat', path).then(
        function(stat) {
            if (stat.isFile() === false) {
                throw new Error('file expected at ' + path);
            }
            return transpiler.transpileFile(path);
        },
        function(e) {
            if (e && e.code === 'ENOENT') {
                return '';
            }
            return Thenable.reject(e);
        }
    );
}
function createFeatureConstructorFromBodySource(body) {
    var constructor = new Function( // eslint-disable-line no-new-func
        'feature',
        'parent',
        'expose',
        'transpile',
        body
    );
    return constructor;
}
// api.getAllFeature(
//     'string/prototype/symbol-iterator'
// ).then(function(features) {
//     console.log('the feature', features);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

api.getAllRequiredTest = function(featureNames, agent) {
    return api.getAllFeature.apply(null, featureNames).then(function(features) {
        return readAllOutputFromFileSystem(
            features,
            agent,
            'test'
        ).then(function() {
            var featuresWithoutTestOutput = features.filter(featureTestIsMissing);
            return {
                features: featuresWithoutTestOutput
            };
        }).then(encodeClient);
    });
};
function readAllOutputFromFileSystem(features, agent, type) {
    var createProperties;
    if (type === 'test') {
        createProperties = createTestOutputProperties;
    } else {
        createProperties = createFixOutputProperties;
    }

    var featuresReady = features.map(function(feature) {
        return readOutputFromFileSystem(
            feature,
            agent,
            createProperties
        ).then(function(output) {
            var propertyName = type + 'Output';
            feature[propertyName] = output;
        });
    });
    return Thenable.all(featuresReady);
}
function createTestOutputProperties(feature, agent) {
    var agentString = agent.toString();
    var featureFolderPath = featuresFolderPath + '/' + feature.name;
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        name: 'test-output.json',
        encode: function(value) {
            return JSON.stringify(value, stringifyErrorReplacer, '\t');
        },
        sources: [
            {
                path: featuresFolderPath + '/' + feature.name + '/feature.js',
                strategy: 'eTag'
            }
        ]
    };
    properties.path = featureAgentCachePath + '/' + properties.name;
    return properties;
}
function createFixOutputProperties(feature, agent) {
    var agentString = agent.toString();
    var featureFolderPath = featuresFolderPath + '/' + feature.name;
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var featureFilePath = featureFolderPath + '/feature.js';
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
    var properties = {
        name: 'fix-output.json',
        encode: function(value) {
            return JSON.stringify(value, stringifyErrorReplacer, '\t');
        },
        cacheMode: 'default',
        sources: sources
    };
    properties.path = featureAgentCachePath + '/' + properties.name;
    return properties;
}
function stringifyErrorReplacer(key, value) {
    if (value instanceof Error) {
        var error = {};
        var properties = [];
        var property;
        for (property in value) { // eslint-disable-line guard-for-in
            properties.push(property);
        }
        var nonEnumerableProperties = ["name", "message", "stack"];
        properties.push.apply(properties, nonEnumerableProperties);
        var i = 0;
        var j = properties.length;
        while (i < j) {
            property = properties[i];
            error[property] = value[property];
            i++;
        }

        return error;
    }
    return value;
}
function readOutputFromFileSystem(feature, agent, createProperties) {
    var cache = getFeatureAgentCache(feature, agent, createProperties);
    return cache.read().then(function(data) {
        if (data.valid) {
            console.log('got valid data for', feature.name);
            return data.value;
        }
        console.log('no valid at', cache.path, 'because', data.reason);
        return undefined;
    });
}
function getFeatureAgentCache(feature, agent, createProperties) {
    var properties = createProperties(feature, agent);
    return store.fileSystemEntry(properties);
}
function featureTestIsMissing(feature) {
    return feature.testOutput === undefined;
}
function encodeClient(data) {
    var concernedFeatures = data.features;
    var dependencies = collectAllDependencies(concernedFeatures);
    var features = concernedFeatures.concat(dependencies);

    // generer un code à évaluer pour une liste de feature
    // c'est le genre de truc qu'on pourra mettre en cache en plus ;)
    var registerFeaturesHead = 'jsenv.registerFeatures(function(registerFeature) {';
    var registerFeaturesBody = features.map(function(feature) {
        var featureNameSource = "'" + feature.name + "'";
        var featurePropertiesConstructorSource = '(' + feature.propertiesConstructor.toString() + ')';
        return (
            'registerFeature(' +
            featureNameSource +
            ', ' +
            featurePropertiesConstructorSource +
            ');'
        );
    });
    var registerFeaturesFoot = '})';
    var registerFeaturesSource = (
        registerFeaturesHead +
        '\n\t' +
        registerFeaturesBody.join('\n\t\n\t') +
        '\n' +
        registerFeaturesFoot
    );
    var metaSource = uneval({
        mustBeTested: concernedFeatures.map(function(feature) {
            return feature.name;
        })
    });

    var source = '';
    source += '({';
    source += '\n\tfeatures: ' + registerFeaturesSource + ',';
    source += '\n\tmeta:' + metaSource;
    source += '\n})';
    return source;
}
function collectAllDependencies(features) {
    var dependencies = [];
    function visit(feature) {
        feature.dependencies.forEach(function(dependency) {
            if (Iterable.includes(dependencies, dependency) === false) {
                dependencies.push(dependency);
                visit(dependency);
            }
        });
    }
    features.forEach(visit);
    return dependencies;
}
// api.getAllRequiredTest(['let'], jsenv.agent).then(function(data) {
//     console.log('required test data', data);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

api.setAllTestRecord = function(records, agent) {
    var outputs = [];
    var featureNames = records.map(function(record) {
        outputs.push(record.output);
        return record.featureName;
    });

    return api.getAllFeature.apply(null, featureNames).then(function(features) {
        return writeAllOutputToFileSystem(
            features,
            agent,
            'test',
            outputs
        );
    });
};
function writeAllOutputToFileSystem(features, agent, type, outputs) {
    var thenables = features.map(function(feature, index) {
        var createProperties;
        if (type === 'test') {
            createProperties = createTestOutputProperties;
        } else {
            createProperties = createFixOutputProperties;
        }

        return writeOutputToFileSystem(
            feature,
            agent,
            createProperties,
            outputs[index]
        ).then(function() {
            return undefined;
        });
    });
    return Thenable.all(thenables);
}
function writeOutputToFileSystem(feature, agent, createProperties, output) {
    var cache = getFeatureAgentCache(feature, agent, createProperties);
    return cache.write(output);
}

api.getAllRequiredFix = function(featureNames, agent) {
    return api.getAllFeature.apply(null, featureNames).then(function(features) {
        return readAllOutputFromFileSystem(
            features,
            agent,
            'test'
        ).then(function() {
            var featuresWithoutTestOutput = features.filter(featureTestIsMissing);
            if (featuresWithoutTestOutput.length) {
                throw new Error('some test are missing: ' + featuresWithoutTestOutput.map(function(feature) {
                    return feature.name;
                }));
            }
            var featuresWithCrashedTest = features.filter(featureTestHasCrashed);
            if (featuresWithCrashedTest.length) {
                throw new Error('some test have crashed: ' + featuresWithCrashedTest.map(function(feature) {
                    return feature.name;
                }));
            }

            var featuresWithFailedTest = features.filter(featureTestHasFailed);
            return featuresWithFailedTest;
        });
    }).then(function(features) {
        var remainingFeatures = features;
        function getFeaturesUsingSolution(solution) {
            var half = Iterable.bisect(remainingFeatures, function(feature) {
                return solution.match(feature);
            });
            remainingFeatures = half[1];
            return half[0];
        }
        var featuresGroup = {
            inline: getFeaturesUsingSolution(inlineSolution),
            file: getFeaturesUsingSolution(fileSolution),
            corejs: getFeaturesUsingSolution(coreJSSolution),
            babel: getFeaturesUsingSolution(babelSolution),
            none: getFeaturesUsingSolution(noSolution)
        };
        var featuresUsingInlineSolution = featuresGroup.inline;
        var featuresUsingFileSolution = featuresGroup.file;
        var featuresUsingCoreJSSolution = featuresGroup.corejs;
        var featuresUsingBabelSolution = featuresGroup.babel;

        return readAllOutputFromFileSystem(
            features,
            agent,
            'fix'
        ).then(function() {
            function getSolutionOwner(feature) {
                var featureOwningSolution = feature;
                while (solutionIsInherited(featureOwningSolution)) {
                    featureOwningSolution = featureOwningSolution.parent;
                }
                return featureOwningSolution;
            }
            function solutionIsInherited(feature) {
                var parent = feature.parent;
                return parent && feature.solution === parent.solution;
            }

            var inlineWithoutFixOutput = featuresUsingInlineSolution.filter(featureFixIsMissing);
            var featuresOwningInlineSolutions = inlineWithoutFixOutput.map(getSolutionOwner);
            var inlineSolver = inlineSolution.solve(featuresOwningInlineSolutions);
            console.log('inline fix', featuresOwningInlineSolutions.length);

            var fileWithoutFixOutput = featuresUsingFileSolution.filter(featureFixIsMissing);
            var featuresOwningFileSolutions = fileWithoutFixOutput.map(getSolutionOwner);
            var fileSolver = fileSolution.solve(featuresOwningFileSolutions);
            console.log('file fix', featuresOwningFileSolutions.length);

            var corejsWithoutFixOutput = featuresUsingCoreJSSolution.filter(featureFixIsMissing);
            var featuresOwningCoreJSSolutions = corejsWithoutFixOutput.map(getSolutionOwner);
            var coreJSSolver = coreJSSolution.solve(featuresOwningCoreJSSolutions);
            console.log('corejs fix', featuresOwningCoreJSSolutions.length);

            var babelWithoutFixOutput = featuresUsingBabelSolution.filter(featureFixIsMissing);
            var featuresOwningAllBabelSolutions = featuresUsingBabelSolution.map(getSolutionOwner);
            var babelSolver = Thenable.resolve(
                babelSolution.solve(featuresOwningAllBabelSolutions)
            ).then(function(transpiler) {
                /*
                it may be the most complex thing involved here so let me explain
                we create a transpiler adapted to required features
                then we create a babel plugin which transpile template literals using that transpiler
                finally we create a transpiler which uses that plugin
                */
                var plugin = createTranspiler.transformTemplateLiteralsPlugin(function(code) {
                    return transpiler.transpile(code, {
                        as: 'code',
                        filename: false,
                        sourceMaps: false,
                        soureURL: false,
                        // disable cache to prevent race condition with the transpiler
                        // that will use this plugin (it's the parent transpiler which is reponsible to cache)
                        cache: false
                    });
                }, 'transpile');
                var fixedFeatureTranspiler = createTranspiler({
                    as: 'code',
                    sourceMaps: false,
                    soureURL: false,
                    plugins: [
                        plugin
                    ]
                });

                var dependencies = collectAllDependencies(babelWithoutFixOutput);
                var featuresToTranspile = babelWithoutFixOutput.concat(dependencies);

                return Thenable.all(featuresToTranspile.map(function(feature) {
                    return readFeatureFromFileSystem(
                        feature.name,
                        fixedFeatureTranspiler
                    ).then(function(source) {
                        feature.propertiesConstructor = createFeatureConstructorFromBodySource(source);
                    });
                }));
            });

            return Thenable.all([
                inlineSolver,
                fileSolver,
                coreJSSolver,
                babelSolver
            ]).then(function(data) {
                return {
                    features: [].concat(
                        inlineWithoutFixOutput,
                        fileWithoutFixOutput,
                        corejsWithoutFixOutput,
                        babelWithoutFixOutput
                    ),
                    meta: {
                        fileSources: data[1],
                        coreJSSource: data[2]
                    }
                };
            }).then(encodeClient);
        });
    });
};
var noSolution = {
    match: featureHasNoSolution
};
var inlineSolution = {
    match: featureUseInlineSolution,

    solve: function() {

    }
};
var fileSolution = {
    match: featureUseFileSolution,

    solve: function(features) {
        var filePaths = [];
        features.forEach(function(feature) {
            var filePath = require('path').resolve(
                featuresFolderPath + '/' + feature.name + '/feature.js',
                feature.solution.value.replace('${rootFolder}', rootFolder)
            );
            if (Iterable.includes(filePaths, filePath)) {
                throw new Error(
                    'two feature cannot share the same file solution ' + filePath
                );
            }
            filePaths.push(filePath);
        });
        // if some feature use the same file we must throw
        var promises = Iterable.map(filePaths, function(filePath) {
            console.log('fetch file solution', filePath);

            return fsAsync.getFileContent(filePath).then(function(content) {
                return new Function('feature', content); // eslint-disable-line no-new-func
            });
        });
        return Thenable.all(promises);
    }
};
var coreJSSolution = {
    match: featureUseCoreJSSolution,

    solve: function(features) {
        var moduleNames = [];
        features.forEach(function(entry) {
            var moduleName = entry.feature.solution.value;
            if (Iterable.includes(moduleNames, moduleName)) {
                throw new Error(
                    'two feature cannot share the same corejs solution ' + moduleName
                );
            }
            moduleNames.push(moduleName);
        });

        function createCoreJSBuild() {
            var source = '';
            Iterable.forEach(features, function(feature) {
                if (feature.solution.beforeFix) {
                    source += '\n' + feature.solution.beforeFix;
                }
            });
            var sourcePromise = Thenable.resolve(source);

            return sourcePromise.then(function(source) {
                if (moduleNames.length) {
                    console.log('concat corejs modules', moduleNames);
                    var buildCoreJS = require('core-js-builder');
                    var promise = buildCoreJS({
                        modules: moduleNames,
                        librabry: false,
                        umd: true
                    });
                    return promise.then(function(polyfill) {
                        source += '\n' + polyfill;

                        return source;
                    });
                }
                return source;
            });
        }

        var polyfillCache = store.fileSystemCache(corejsCacheFolder);
        return polyfillCache.match({
            modules: moduleNames
        }).then(function(cacheBranch) {
            return memoize.async(
                createCoreJSBuild,
                cacheBranch.entry({
                    name: 'build.js'
                })
            )();
        });
    }
};
var babelSolution = {
    match: featureUseBabelSolution,

    solve: function(features) {
        var plugins = [];
        features.forEach(function(feature) {
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
            var name = solution.value;
            var options = createOptions();

            var existingPlugin = Iterable.find(plugins, function(plugin) {
                return plugin.name === name;
            });
            if (existingPlugin) {
                throw new Error(
                    'two feature cannot share the same babel solution ' + name
                );
            } else {
                plugins.push({
                    name: name,
                    options: options
                });
            }
        });

        var pluginsAsOptions = Iterable.map(plugins, function(plugin) {
            return [plugin.name, plugin.options];
        });
        return createTranspiler({
            cache: true,
            cacheMode: 'default',
            plugins: pluginsAsOptions
        });
    }
};
function featureTestHasCrashed(feature) {
    return feature.testOutput.status === 'crashed';
}
function featureTestHasFailed(feature) {
    return feature.testOutput.detail.status === 'invalid';
}
function featureFixIsMissing(feature) {
    return feature.fixOutput === undefined;
}
function featureHasNoSolution(feature) {
    return feature.solution.type === 'none';
}
function featureUseInlineSolution(feature) {
    return feature.solution.type === 'inline';
}
function featureUseFileSolution(feature) {
    return feature.solution.type === 'file';
}
function featureUseCoreJSSolution(feature) {
    return feature.solution.type === 'corejs';
}
function featureUseBabelSolution(feature) {
    return feature.solution.type === 'babel';
}
api.getAllRequiredFix(
    ['const/scoped'],
    jsenv.agent
).then(function(data) {
    console.log('required fix data', data);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

api.setAllFixRecord = function(records, agent) {
    var outputs = [];
    var featureNames = records.map(function(record) {
        outputs.push(record.output);
        return record.featureName;
    });

    return api.getAllFeature.apply(null, featureNames).then(function(features) {
        return writeAllOutputToFileSystem(
            features,
            agent,
            'fix',
            outputs
        );
    });
};

api.createOwnMediator = function(featureNames, agent) {
    agent = Agent.parse(agent);

    return {
        send: function(action, value) {
            if (action === 'getAllRequiredTest') {
                return api.getAllRequiredTest(featureNames, agent).then(fromServer);
            }
            if (action === 'setAllTestRecord') {
                return api.setAllTestRecord(value, agent);
            }
            if (action === 'getAllRequiredFix') {
                return api.getAllRequiredFix(featureNames, agent).then(fromServer);
            }
            if (action === 'setAllFixRecord') {
                return api.setAllFixRecord(value, agent);
            }
        }
    };

    function fromServer(source) {
        var data;
        try {
            data = eval(source); // eslint-disable-line no-eval
        } catch (e) {
            // some feature source lead to error
            throw e;
        }
        return data;
    }
};

function createBrowserMediator(featureNames) {
    return {
        send: function(action, value) {
            if (action === 'getAllRequiredTest') {
                return get(
                    'test?features=' + featureNames.join(encodeURIComponent(','))
                ).then(readBody);
            }
            if (action === 'setAllTestRecord') {
                return postAsJSON(
                    'test',
                    value
                );
            }
            if (action === 'getAllRequiredFix') {
                return get(
                    'fix?features=' + featureNames.join(encodeURIComponent(','))
                ).then(readBody);
            }
            if (action === 'setAllFixRecord') {
                return postAsJSON(
                    'fix',
                    value
                );
            }
        }
    };

    function get(url) {
        return sendRequest(
            'GET',
            url,
            {},
            null
        ).then(checkStatus);
    }
    function postAsJSON(url, object) {
        return sendRequest(
            'POST',
            url,
            {
                'content-type': 'application/json'
            },
            JSON.stringify(object)
        ).then(checkStatus);
    }
    function checkStatus(response) {
        if (response.status < 200 || response.status > 299) {
            throw new Error(response.status);
        }
        return response;
    }
    function sendRequest(method, url, headers, body) {
        var xhr = new XMLHttpRequest();

        return new jsenv.Thenable(function(resolve, reject) {
            var responseBody = {
                data: '',
                write: function(chunk) {
                    this.data += chunk;
                },
                close: function() {}
            };

            xhr.onerror = function(e) {
                reject(e);
            };
            var offset = 0;
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 2) {
                    resolve({
                        status: xhr.status,
                        headers: xhr.getAllResponseHeaders(),
                        body: responseBody
                    });
                } else if (xhr.readyState === 3) {
                    var data = xhr.responseText;
                    if (offset) {
                        data = data.slice(offset);
                    }
                    offset += data.length;
                    responseBody.write(data);
                } else if (xhr.readyState === 4) {
                    responseBody.close();
                }
            };

            xhr.open(method, url);
            for (var headerName in headers) {
                if (headers.hasOwnPorperty(headerName)) {
                    xhr.setRequestHeader(headerName, headers[headerName]);
                }
            }
            xhr.send(body || null);
        });
    }
    function readBody(response) {
        var body = response.body;
        var object = JSON.parse(body);
        object.entries = getClientEntries(object.entries);
        jsenv.assign(object, body.meta);
        delete object.meta;
        return object;
    }
    function getClientEntries(entries) {
        // try {
        //     jsenv.reviveFeatureEntries(entries);
        // } catch (e) {
        //     return fail('some-feature-source', e);
        // }
        return entries;
    }
}
api.createBrowserMediator = createBrowserMediator;

var ownMediator = api.createOwnMediator(
    [
        'promise/unhandled-rejection'
    ],
    String(jsenv.agent)
);
api.client = jsenv.createImplementationClient(ownMediator);

api.getClosestAgentForFeature = function(agent, feature) {
    var featureFolderPath = featuresFolderPath + '/' + feature.name;
    var featureCachePath = featureFolderPath + '/.cache';

    function adaptAgentName(agent, path) {
        return visibleFallback(
            path + '/' + agent.name,
            function() {
                agent.name = 'other';
                return path + '/' + agent.name;
            }
        );
    }
    function visibleFallback(path, fallback) {
        return fsAsync.visible(path).catch(function() {
            return Promise.resolve(fallback()).then(function(fallbackPath) {
                if (fallbackPath) {
                    return fsAsync.visible(fallbackPath);
                }
            });
        });
    }
    function adaptVersion(version, path) {
        var cachePath = path + '/' + version + '/test-output.json';
        return visibleFallback(
            cachePath,
            function() {
                return fsAsync('readdir', path).then(function(names) {
                    var availableVersions = names.map(function(name) {
                        return jsenv.createVersion(name);
                    }).filter(function(version) {
                        // exclude folder name like ?, * or alphabetic
                        return version.isSpecified();
                    }).sort(function(a, b) {
                        if (a.above(b)) {
                            return 1;
                        }
                        if (a.below(b)) {
                            return -1;
                        }
                        return 0;
                    });

                    var i = 0;
                    var j = availableVersions.length;
                    var previousVersions = [];
                    while (i < j) {
                        var availableVersion = availableVersions[i];
                        if (version.above(availableVersion)) {
                            previousVersions.unshift(availableVersion);
                        } else {
                            break;
                        }
                        i++;
                    }
                    return Promise.all(previousVersions.map(function(previousVersion) {
                        return fsAsync.visible(path + '/' + previousVersion + '/test-output.json').then(
                            function() {
                                // console.log('valid previous version ' + previousVersion);
                                return true;
                            },
                            function() {
                                // console.log('invalid previous version ' + previousVersion);
                                return false;
                            }
                        );
                    })).then(function(validities) {
                        return previousVersions.find(function(previousVersion, index) {
                            return validities[index];
                        });
                    }).then(function(closestPreviousValidVersion) {
                        if (closestPreviousValidVersion) {
                            version.update(closestPreviousValidVersion);
                        } else {
                            version.update('?');
                            return path + '/' + version;
                        }
                    });
                });
            }
        );
    }

    var closestAgent = jsenv.createAgent(agent.name, agent.version);
    return adaptAgentName(
        closestAgent,
        featureCachePath
    ).catch(function(e) {
        if (e && e.code === 'ENOENT') {
            throw new Error(feature.name + ' feature has no cache for agent ' + agent.name);
        }
        return Promise.reject(e);
    }).then(function() {
        return adaptVersion(
            closestAgent.version,
            featureCachePath + '/' + closestAgent.name
        ).catch(function(e) {
            if (e && e.code === 'ENOENT') {
                throw new Error(feature.name + ' feature has no cache for ' + agent);
            }
            return Promise.reject(e);
        });
    }).then(function() {
        return closestAgent;
    });
};
// api.getClosestAgentForFeature(
//     {
//         name: 'const'
//     },
//     jsenv.createAgent('node/4.7.4')
// ).then(function(agent) {
//     console.log('agent', agent.toString());
// }).catch(function(e) {
//     console.log('rejected with', e);
// });

api.getFixSource = function(featureNames, agent) {
    return api.getAllFeature.apply(null, featureNames).then(function(features) {
        var promises = features.map(function(feature) {
            return api.getClosestAgentForFeature(agent, feature);
        });
        return Thenable.all(promises).then(function() {
            // got the cache path for all feature
            // now we can keep going
        });
    });
};

// api.client.scan().then(function() {
//     console.log('here', Math.DEG_PER_RAD);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

module.exports = api;
