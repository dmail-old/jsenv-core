/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- en fait ce qu'on a fait suffti pas pour les fix de type file
puisque si une dépendance est de type file on aura pas fetch
pareil pour corejs

- mettre en place limit: {value: number, strategy: string} dans store.js
parce que ça a des impacts sur l amanière dont on utilise l'api ensuite
en effet, le fait qu'une branche puisse disparaitre signifique que lorsqu'on fait entry.write
il faut absolument s'assurer que la branche est toujours présente dans branches.json
et n'a pas été effacé entre temps

- minification

- sourcemap

*/

require('../jsenv.js');
var path = require('path');
var Agent = require('../agent/agent.js');

var fsAsync = require('../fs-async.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var createTranspiler = require('../transpiler/transpiler.js');
var rootFolder = path.resolve(__dirname, '../../').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var corejsCacheFolder = cacheFolder + '/corejs';
var readDependencies = require('./read-module-dependencies.js');

var Iterable = jsenv.Iterable;
var Thenable = jsenv.Thenable;

var getFolder = require('./get-folder.js');
function folderFromFeatureName(featureName) {
    return getFolder() + '/' + featureName;
}
function featureNameFromFile(file) {
    var relative = file.slice(getFolder().length + 1);
    return jsenv.parentPath(relative);
}
function featureNameFromNode(node) {
    return featureNameFromFile(node.id);
}
var listFeatureNames = require('./list-feature-names.js');
var build = require('./build.js');
var transpiler = require('./transpiler.js');
var api = {};

function mapAsync(iterable, fn) {
    return Thenable.all(iterable.map(fn));
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
function stringify(value) {
    try {
        return JSON.stringify(value, stringifyErrorReplacer, '\t');
    } catch (e) {
        return '[Circular]';
    }
}
function createTestOutputProperties(featureName, agent) {
    var agentString = agent.toString();
    var featureFolderPath = getFolder() + '/' + featureName;
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        name: 'test-output.json',
        encode: stringify,
        sources: [
            {
                path: folderFromFeatureName(featureName) + '/test.js',
                strategy: 'eTag'
            }
        ],
        // mode: 'write-only'
        mode: 'default'
    };
    properties.path = featureAgentCachePath + '/' + properties.name;
    return properties;
}
function createFixOutputProperties(featureName, agent) {
    var agentString = agent.toString();
    var featureFolderPath = folderFromFeatureName(featureName);
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var featureFilePath = featureFolderPath + '/fix.js';
    var sources = [
        {
            path: featureFilePath,
            strategy: 'eTag'
        }
    ];
    var properties = {
        name: 'fix-output.json',
        encode: stringify,
        mode: 'write-only',
        // mode: 'default',
        sources: sources
    };
    properties.path = featureAgentCachePath + '/' + properties.name;
    return properties;
}
function readOutputFromFileSystem(featureName, agent, createProperties) {
    var cache = getFeatureAgentCache(featureName, agent, createProperties);
    return cache.read();
}
function getFeatureAgentCache(featureName, agent, createProperties) {
    var properties = createProperties(featureName, agent);
    return store.fileSystemEntry(properties);
}
function readRecordFromFileSystem(featureName, agent, type) {
    var createProperties;
    if (type === 'test') {
        createProperties = createTestOutputProperties;
    } else {
        createProperties = createFixOutputProperties;
    }

    return readOutputFromFileSystem(
        featureName,
        agent,
        createProperties
    ).then(function(data) {
        if (data.valid) {
            console.log('got valid data for', featureName);
        } else {
            console.log('no valid for', featureName, 'because', data.reason);
        }

        return {
            name: featureName,
            data: data
        };
    });
}
function recordIsMissing(record) {
    return record.data.valid === false && record.data.reason === 'file-not-found';
}
function recordIsInvalid(record) {
    return record.data.valid === false;
}
function getStatus(featureName, featureAgent, includeFix) {
    return readRecordFromFileSystem(
        featureName,
        featureAgent,
        'test'
    ).then(function(testRecord) {
        if (recordIsMissing(testRecord)) {
            return 'test-missing';
        }
        if (recordIsInvalid(testRecord)) {
            return 'test-invalid';
        }
        if (recordIsFailed(testRecord)) {
            if (includeFix) {
                return readRecordFromFileSystem(
                    featureName,
                    featureAgent,
                    'fix'
                ).then(function(fixRecord) {
                    if (recordIsMissing(fixRecord)) {
                        return 'test-failed-and-fix-missing';
                    }
                    if (recordIsInvalid(fixRecord)) {
                        return 'test-failed-and-fix-invalid';
                    }
                    if (recordIsFailed(fixRecord)) {
                        return 'test-failed-and-fix-failed';
                    }
                    return 'test-failed-and-fix-passed';
                });
            }
            return 'test-failed';
        }
        return 'test-passed';
    });
}
function getAllDependencies(featureNames, mode) {
    var filename = mode === 'test' ? 'test' : 'fix';
    var featureTests = featureNames.map(function(featureName) {
        return './' + featureName + '/' + filename + '.js';
    });
    var folderPath = getFolder();
    return readDependencies(
        featureTests,
        {
            root: folderPath,
            exclude: function(id) {
                if (id.indexOf(folderPath) !== 0) {
                    return true;
                }
                return path.basename(id) !== filename + '.js';
            },
            autoParentDependency: function(id) {
                // si id est dans folderPath mais n'est pas un enfant direct de folderPath
                // folderPath/a/file.js non
                // mais folderpath/a/b/file.js oui et on renvoit folderpath/a/file.js

                // file must be inside folder
                if (id.indexOf(folderPath) !== 0) {
                    return;
                }
                var relative = id.slice(folderPath.length + 1);
                var relativeParts = relative.split('/');
                // folderPath/a/file.js -> nope
                if (relativeParts.length < 3) {
                    return;
                }
                // folderpath/a/b/file.js -> yep
                return folderPath + '/' + relativeParts.slice(0, -2) + '/' + filename + '.js';
            }
        }
    );
}
function getNodes(featureNames, mode) {
    return getAllDependencies(featureNames, mode).then(function(featureGraph) {
        return featureGraph.concat(jsenv.collectDependencies(featureGraph));
    });
}
function getTestInstructions(featureNames, agent) {
    return getNodes(featureNames, 'test').then(function(featureNodes) {
        return mapAsync(featureNodes, function(featureNode) {
            return getStatus(featureNameFromFile(featureNode.id), agent);
        }).then(function(statuses) {
            var featureNodesToTest = Iterable.filterBy(featureNodes, statuses, function(status) {
                return (
                    status === 'test-missing' ||
                    status === 'test-invalid'
                );
            });
            return build(
                featureNodesToTest.map(function(featureNode) {
                    return {
                        name: {
                            type: 'inline',
                            name: '',
                            from: featureNameFromFile(featureNode.id)
                        },
                        testDependencies: {
                            type: 'inline',
                            name: '',
                            from: featureNode.dependencies.map(function(dependency) {
                                return featureNodesToTest.indexOf(dependency);
                            })
                        },
                        test: {
                            type: 'import',
                            name: 'default',
                            from: './' + featureNameFromFile(featureNode.id) + '/test.js'
                        }
                    };
                }),
                {
                    transpiler: transpiler,
                    root: getFolder()
                }
            ).then(function(bundle) {
                return bundle.source;
            });
        });
    });
}
// getTestInstructions(
//     ['object/assign'],
//     jsenv.agent
// ).then(function(data) {
//     console.log('required test data', data);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

api.setAllTestRecord = function(records, agent) {
    return writeAllRecordToFileSystem(
        records,
        agent,
        'test'
    );
};
function writeAllRecordToFileSystem(records, agent, type) {
    var outputsPromises = records.map(function(record) {
        var createProperties;
        if (type === 'test') {
            createProperties = createTestOutputProperties;
        } else {
            createProperties = createFixOutputProperties;
        }

        return writeOutputToFileSystem(
            record.name,
            agent,
            createProperties,
            record.data
        ).then(function() {
            return undefined;
        });
    });
    return Thenable.all(outputsPromises);
}
function writeOutputToFileSystem(featureName, agent, createProperties, output) {
    var cache = getFeatureAgentCache(featureName, agent, createProperties);
    return cache.write(output);
}
function pickFeaturesUsingSolution(features, solution) {
    var i = 0;
    var j = features.length;
    var result = [];
    while (i < j) {
        var feature = features[i];
        if (solution.match(feature)) {
            features.splice(i, 1);
            result.push(feature);
            j--;
        } else {
            i++;
        }
    }
    return result;
}
function groupBySolution(features) {
    var groups = {
        inline: pickFeaturesUsingSolution(features, inlineSolution),
        file: pickFeaturesUsingSolution(features, fileSolution),
        corejs: pickFeaturesUsingSolution(features, coreJSSolution),
        babel: pickFeaturesUsingSolution(features, babelSolution),
        none: pickFeaturesUsingSolution(features, noSolution),
        remaining: features
    };
    return groups;
}
function getUniqSolutions(features) {
    var solutions = features.map(function(feature) {
        return feature.fix;
    });
    // a-t-on besoin de récup les solution dépendantes ?
    // parce que si elle ne sont pas déjà là
    // c'est que leur test est ok
    // et donc que la solution n'est pas requise
    // if (excludeDependencies !== true) {
    //     var solutionsDependencies = jsenv.collectDependencies(solutions);
    //     solutions.push.apply(solutions, solutionsDependencies);
    // }
    return Iterable.uniq(solutions);
}
function getFixInstructions(featureNames, agent, mode) {
    mode = mode || 'fix';
    var getAgent;
    if (mode === 'fix') {
        getAgent = function() {
            return agent;
        };
    } else {
        getAgent = function(feature) {
            // en fait c'est pas vraiment le getAgent qui doit catch mais le getStatus
            // qui lorsqu'il est appelé doit retourner test-missing
            // lorsque aucun test-output.json n'est trouvé pour cette feature
            return getClosestAgentForFeature(feature, agent).catch(function(e) {
                if (e) {
                    if (e.code === 'NO_AGENT') {
                        return {
                            valid: false,
                            reason: 'no-agent',
                            detail: e
                        };
                    }
                    if (e.code === 'NO_AGENT_VERSION') {
                        return {
                            valid: false,
                            reason: 'no-agent-version',
                            detail: e
                        };
                    }
                }
                return Promise.reject(e);
            });
        };
    }

    return getAllDependencies(featureNames, 'fix').then(function(featureGraph) {
        var featureNodes = featureGraph.concat(jsenv.collectDependencies(featureGraph));

        return mapAsync(featureNodes, function(featureNode) {
            return getAgent(featureNameFromFile(featureNode.id), agent);
        }).then(function(agents) {
            return mapAsync(featureNodes, function(featureNode, index) {
                return getStatus(featureNameFromFile(featureNode.id), agents[index]);
            });
        }).then(function(statuses) {
            if (mode === 'fix') {
                var featureWithMissingOrInvalidTest = Iterable.filterBy(featureNodes, statuses, function(status) {
                    return (
                        status === 'test-missing' ||
                        status === 'test-invalid'
                    );
                });
                if (featureWithMissingOrInvalidTest.length) {
                    throw new Error('some test are missing or invalid: ' + featureWithMissingOrInvalidTest);
                }

                return Iterable.filterBy(featureNodes, statuses, function(status) {
                    return (
                        status === 'test-failed-and-fix-missing' ||
                        status === 'test-failed-and-fix-invalid'
                    );
                });
            }
            if (mode === 'polyfill') {
                var featureWithFailedTestAndFailedFix = Iterable.filterBy(
                    featureNodes,
                    statuses,
                    function(status) {
                        return status === 'test-failed-and-fix-failed';
                    }
                );
                // je ne suis pas sur qu'on va throw
                // on va ptet juste ne rien faire parce qu'on sait que ca créé une erreur plutot
                if (featureWithFailedTestAndFailedFix.length) {
                    throw new Error('unfixable features ' + featureWithFailedTestAndFailedFix);
                }

                return Iterable.filterBy(featureNodes, statuses, function(status) {
                    return (
                        status === 'test-missing' ||
                        status === 'test-invalid' ||
                        status === 'test-failed-and-fix-missing' ||
                        status === 'test-failed-and-fix-invalid' ||
                        status === 'test-failed-and-fix-passed'
                    );
                });
            }
        }).then(function(featureNodesToFix) {
            console.log('features to fix', featureNodesToFix.map(function(node) {
                return featureNameFromFile(node.id);
            }));
            var abstractFeatures = featureNodesToFix.map(function(featureNode) {
                return {
                    name: {
                        type: 'inline',
                        name: '',
                        from: featureNameFromFile(featureNode.id)
                    },
                    fix: {
                        type: 'import',
                        name: 'default',
                        from: './' + featureNameFromFile(featureNode.id) + '/fix.js'
                    },
                    fixDependencies: {
                        type: 'inline',
                        name: '',
                        from: featureNode.dependencies.map(function(dependency) {
                            return featureNodesToFix.indexOf(dependency);
                        })
                    }
                };
            });

            return build(
                abstractFeatures,
                {
                    root: getFolder(),
                    transpiler: transpiler
                }
            ).then(function(bundle) {
                return bundle.compile();
            });
        }).then(function(featuresToFix) {
            var groups = groupBySolution(featuresToFix);

            var inlineSolutions = getUniqSolutions(groups.inline);
            var inlineSolver = inlineSolution.solve(inlineSolutions);
            console.log('inline fix', inlineSolutions.length);

            var fileSolutions = getUniqSolutions(groups.file);
            var fileSolver = fileSolution.solve(fileSolutions);
            console.log('file fix', fileSolutions.length);

            var coreJSSolutions = getUniqSolutions(groups.corejs);
            var coreJSSolver = coreJSSolution.solve(coreJSSolutions);
            console.log('corejs fix', coreJSSolutions.length);

            return Thenable.all([
                inlineSolver,
                fileSolver,
                coreJSSolver
            ]).then(function(data) {
                var fileFunctions = data[1];
                var coreJSFunction = data[2];
                var abstractFeatures = featuresToFix.map(function(feature) {
                    var abstractFeature = {
                        name: {
                            type: 'inline',
                            name: '',
                            from: feature.name
                        },
                        fix: {
                            type: 'import',
                            name: 'default',
                            from: './' + feature.name + '/fix.js'
                        },
                        fixDependencies: {
                            type: 'inline',
                            name: '',
                            from: feature.fixDependencies
                        }
                    };
                    if (feature.fix.type === 'file') {
                        var index = fileSolutions.indexOf(feature.solution);
                        abstractFeature.fixFunction = fileFunctions[index];
                    }

                    return abstractFeature;
                });

                if (mode === 'fix') {
                    var loadTestIntoAbstracts = function loadTestIntoAbstracts() {
                        var featureNamesToTest = featuresToFix.map(function(feature) {
                            return feature.name;
                        });

                        return getNodes(
                            featureNamesToTest,
                            'test'
                        ).then(function(testNodes) {
                            testNodes.forEach(function(testNode) {
                                var featureName = featureNameFromNode(testNode);
                                var abstract = Iterable.find(abstractFeatures, function(abstractFeature) {
                                    return abstractFeature.name.from === featureName;
                                });
                                var abstractTestProperty = {
                                    type: 'import',
                                    name: 'default',
                                    from: './' + featureName + '/test.js'
                                };
                                var abstractTestDependenciesProperty = {
                                    type: 'inline',
                                    name: ''
                                };

                                // en fait faudrais un fixTestDependencies
                                // enfin chais pas...
                                // non pas besoin la feature exprime des testsDependencies
                                // si cette feature est fix, il faut la retester
                                // si on la reteste on a besoin

                                if (abstract) {
                                    abstract.test = abstractTestProperty;
                                    abstract.testDependencies = abstractTestDependenciesProperty;
                                } else {
                                    abstract = {
                                        name: {
                                            type: 'inline',
                                            name: '',
                                            value: featureName
                                        },
                                        test: abstractTestProperty,
                                        testDependencies: abstractTestDependenciesProperty
                                    };
                                    abstractFeatures.push(abstract);
                                }

                                // on connais le from que ici puisqu'on fait abstractFeatures.push(abstract);
                                abstractTestDependenciesProperty.from = testNode.dependencies.map(function(dependency) {
                                    return abstractFeatures.indexOf(dependency);
                                });
                            });
                        });
                    };
                    var loadFixedTranspiler = function loadFixedTranspiler() {
                        var babelSolutions = getUniqSolutions(groups.babel);
                        var babelSolver = Thenable.resolve(babelSolution.solve(babelSolutions));

                        return babelSolver.then(function(babelTranspiler) {
                            /*
                            it may be the most complex thing involved here so let me explain
                            we create a transpiler adapted to required features
                            then we create a babel plugin which transpile template literals using that transpiler
                            finally we create a transpiler which uses that plugin
                            */
                            var plugin = createTranspiler.transpileTemplateTaggedWith(function(code) {
                                return babelTranspiler.transpile(code, {
                                    as: 'code',
                                    filename: false,
                                    sourceMaps: false,
                                    soureURL: false,
                                    // disable cache to prevent race condition with the transpiler
                                    // that will use this plugin (it's the parent transpiler which is reponsible to cache)
                                    cache: false
                                });
                            }, 'transpile');
                            var fixedTranspiler = transpiler.clone();
                            fixedTranspiler.options.plugins.push(plugin);
                            return fixedTranspiler;
                        });
                    };

                    return Promise.all(
                        [
                            loadTestIntoAbstracts(),
                            loadFixedTranspiler()
                        ]
                    ).then(function(data) {
                        var fixedTranspiler = data[1];
                        return build(
                            abstractFeatures,
                            {
                                root: getFolder(),
                                transpiler: fixedTranspiler,
                                meta: {
                                    coreJSFunction: coreJSFunction
                                }
                            }
                        );
                    }).then(function(bundle) {
                        return bundle.source;
                    });
                }
                return build(
                    abstractFeatures,
                    {
                        root: getFolder(),
                        transpiler: transpiler,
                        meta: {
                            coreJSFunction: coreJSFunction
                        },
                        footer: 'jsenv.polyfill(__exports__);'
                    }
                ).then(function(bundle) {
                    return bundle.source;
                });
            });
        });
    });
}
function recordIsFailed(record) {
    return record.data.value.status === 'failed';
}
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

    solve: function(solutions) {
        // console.log('the solutions', solutions);
        var filePaths = [];
        solutions.forEach(function(solution) {
            var solutionValue = solution.value;
            var filePath;
            if (solutionValue.indexOf('${rootFolder}') === 0) {
                filePath = solutionValue.replace('${rootFolder}', rootFolder);
            } else {
                if (solutionValue[0] === '.') {
                    throw new Error('solution path must be absolute');
                }
                filePath = path.resolve(
                    rootFolder,
                    solutionValue
                );
            }

            var index = filePaths.indexOf(filePath);
            if (index > -1) {
                throw new Error(
                    'file solution duplicated' + filePath
                );
            }
            filePaths.push(filePath);
        });
        // console.log('filepaths', filePaths);
        var promises = Iterable.map(filePaths, function(filePath) {
            console.log('fetch file solution', filePath);
            return fsAsync.getFileContent(filePath).then(function(content) {
                return new Function(content); // eslint-disable-line no-new-func
            });
        });
        return Thenable.all(promises);
    }
};
var coreJSSolution = {
    match: featureUseCoreJSSolution,

    solve: function(solutions) {
        var moduleNames = [];
        solutions.forEach(function(solution) {
            var moduleName = solution.value;
            var index = moduleNames.indexOf(moduleName);
            if (index > -1) {
                throw new Error(
                    'corejs solution duplicated' + moduleName
                );
            }
            moduleNames.push(moduleName);
        });

        function createCoreJSBuild() {
            var source = '';
            Iterable.forEach(solutions, function(solution) {
                if (solution.beforeFix) {
                    source += '\n' + solution.beforeFix;
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
        }).then(function(source) {
            return new Function(source); // eslint-disable-line no-new-func
        });
    }
};
var babelSolution = {
    match: featureUseBabelSolution,

    solve: function(solutions) {
        var plugins = [];
        solutions.forEach(function(solution) {
            var createOptions = function() {
                var options = {};
                if ('config' in solution) {
                    var config = solution.config;
                    if (typeof config === 'object') {
                        jsenv.assign(options, config);
                    } else if (typeof config === 'function') {
                        jsenv.assign(options, config(solutions));
                    }
                }
                return options;
            };
            var name = solution.value;
            var options = createOptions();

            var existingPluginIndex = Iterable.findIndex(plugins, function(plugin) {
                return plugin.name === name;
            });
            if (existingPluginIndex > -1) {
                throw new Error(
                    'babel solution duplicated ' + name
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
function featureHasNoSolution(feature) {
    return feature.fix.type === 'none';
}
function featureUseInlineSolution(feature) {
    return feature.fix.type === 'inline';
}
function featureUseFileSolution(feature) {
    return feature.fix.type === 'file';
}
function featureUseCoreJSSolution(feature) {
    return feature.fix.type === 'corejs';
}
function featureUseBabelSolution(feature) {
    return feature.fix.type === 'babel';
}
// getFixInstructions(
//     ['object'],
//     jsenv.agent
// ).then(function(data) {
//     console.log('required fix data', data);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function setAllFixRecord(records, agent) {
    return writeAllRecordToFileSystem(
        records,
        agent,
        'fix'
    );
}

api.createOwnMediator = function(featureNames, agent) {
    agent = Agent.parse(agent);

    return {
        send: function(action, value) {
            if (action === 'getTestInstructions') {
                return getTestInstructions(featureNames, agent).then(fromServer);
            }
            if (action === 'setAllTestRecord') {
                return api.setAllTestRecord(value, agent);
            }
            if (action === 'getFix') {
                return api.getAllRequiredFix(featureNames, agent).then(fromServer);
            }
            if (action === 'setAllFixRecord') {
                return setAllFixRecord(value, agent);
            }
        }
    };

    function fromServer(source) {
        var data;
        try {
            // console.log('evaluating', source);
            data = eval(source); // eslint-disable-line no-eval
        } catch (e) {
            // some feature source lead to error
            throw e;
        }
        return data;
    }
};
var ownMediator = api.createOwnMediator(
    [
        // 'promise/unhandled-rejection',
        // 'promise/rejection-handled'
        // 'const/scoped'
        'object/keys'
    ],
    String(jsenv.agent)
);
api.client = jsenv.createImplementationClient(ownMediator);
api.client.test().then(function() {
    console.log(Object.assign);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

function getClosestAgentForFeature(agent, featureName) {
    var featureFolderPath = folderFromFeatureName(featureName);
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
                        return Iterable.find(previousVersions, function(previousVersion, index) {
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
    function missingAgent() {
        var missing = {
            code: 'NO_AGENT',
            featureName: featureName,
            agentName: agent.name
        };
        return missing;
    }
    function missingVersion() {
        var missing = {
            code: 'NO_AGENT_VERSION',
            featureName: featureName,
            agentName: agent.name,
            agentVersion: agent.version.toString()
        };
        return missing;
    }

    var closestAgent = jsenv.createAgent(agent.name, agent.version);
    return adaptAgentName(
        closestAgent,
        featureCachePath
    ).catch(function(e) {
        if (e && e.code === 'ENOENT') {
            return Promise.reject(missingAgent());
        }
        return Promise.reject(e);
    }).then(function() {
        return adaptVersion(
            closestAgent.version,
            featureCachePath + '/' + closestAgent.name
        ).catch(function(e) {
            if (e && e.code === 'ENOENT') {
                return Promise.reject(missingVersion());
            }
            return Promise.reject(e);
        });
    }).then(function() {
        return closestAgent;
    });
}
// getClosestAgentForFeature(
//     {
//         name: 'const'
//     },
//     jsenv.createAgent('node/4.7.4')
// ).then(function(agent) {
//     console.log('agent', agent.toString());
// }).catch(function(e) {
//     console.log('rejected with', e);
// });

function polyfill(featureNames) {
    return Promise.resolve([]).then(function(instructions) {
        // console.log('instructions', instructions);
        var failingFeatureNames = Iterable.filterBy(featureNames, instructions, function(instruction) {
            return instruction.name === 'fail';
        });
        if (failingFeatureNames.length) {
            throw new Error('unfixable features ' + failingFeatureNames);
        }
        var featureNamesToFix = Iterable.filterBy(featureNames, instructions, function(instruction) {
            return instruction.name === 'fix';
        });
        console.log('features to polyfill', featureNamesToFix);
        return build(featureNamesToFix, {
            transpiler: transpiler,
            mode: 'polyfill',
            footer: 'jsenv.polyfill(__exports__);'
        }).then(function(bundle) {
            return bundle.source;
        });
    });
}
// polyfill(
//     ['object/assign'],
//     jsenv.agent
// ).then(function(polyfill) {
//     console.log('polyfill', polyfill);
//     eval(polyfill);
//     console.log(Object.assign);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function transpile(/* path, featureNames, agent */) {

}

function createBrowserMediator(featureNames) {
    return {
        send: function(action, value) {
            if (action === 'getTestInstructions') {
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
            if (action === 'getFixInstructions') {
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

api.getFolder = getFolder;
api.getFeaturePath = folderFromFeatureName;
api.listFeatureNames = listFeatureNames;
api.build = build;
api.transpiler = transpiler;
api.getTestInstructions = getTestInstructions;
api.getClosestAgent = getClosestAgentForFeature;
api.getFixInstructions = getFixInstructions;
api.polyfill = polyfill;
api.transpile = transpile;

module.exports = api;

// function excludedAlreadyResolvedDependency(id) {
    // en gros ici, si la dépendance a un test déjà satisfait
    // alors résoud à {type: 'excluded'}
    // (ce qu'on fait dans polyfill, en plus il faudrait vérifier si on a pas djà
    // kk chose dans statuses

    // console.log('load', id);
    // on pourrais aussi déplacer ça dans resolveId
    // et rediriger #weak vers un fichier spécial qui contient grosso modo
    // export default {weak: true};
    // var fixMark = '/fix.js';
    // var fixLength = fixMark.length;
    // var isFix = id.slice(-fixLength) === fixMark;
    // console.log('isfix', isFix);
    // if (isFix) {
    //     var featureName = path.dirname(path.relative(getFeaturesFolder(), id));
    //     var featureNameIndex = featureNames.indexOf(featureName);
    //     var instructionPromise;
    //     if (featureNameIndex === -1) {
    //         instructionPromise = getInstruction(featureName, agent);
    //     } else {
    //         instructionPromise = Promise.resolve(instructions[featureNameIndex]);
    //     }
    //     return instructionPromise.then(function(instruction) {
    //         if (instruction.name === 'fail') {
    //             throw new Error('unfixable dependency ' + featureName);
    //         }
    //         if (instruction.name === 'fix') {
    //             return undefined;
    //         }
    //         return 'export default {type: \'excluded\'};';
    //     });
    // }
    // console.log('ici', id);
// }
