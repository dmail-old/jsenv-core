/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- transpile() doit marcher avec const

- changer feature.name pour feature.id

- il faudrais que polyfill/transpile retourne le chemin vers le fichier
plutot que le contenu de celui-ci
comme ça un serveur pourra servir le fichier et utiliser mtime/etag fetch
en plus cela montre bien que le fichier doit rester et donc qu'il ne faut pas mettre en place
de cache ayant une limite car le fichier doit rester accessible

- mettre en place limit: {value: number, strategy: string} dans store.js
parce que ça a des impacts sur la manière dont on utilise l'api ensuite
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
function recordIsFailed(record) {
    return record.data.value.status === 'failed';
}
function getStatus(featureName, agent, includeFix, enableClosestAgent) {
    var featureAgentPromise;
    if (enableClosestAgent) {
        featureAgentPromise = getClosestAgentForFeature(featureName, agent);
    } else {
        featureAgentPromise = Promise.resolve(agent);
    }
    return featureAgentPromise.then(
        function(featureAgent) {
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
        },
        function(e) {
            if (e && (e.code === 'NO_AGENT' || e.code === 'NO_AGENT_VERSION')) {
                if (includeFix) {
                    return 'test-missing-and-fix-missing';
                }
                return 'test-missing';
            }
            return Promise.reject(e);
        }
    );
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
            return getStatus(featureNameFromNode(featureNode), agent);
        }).then(function(statuses) {
            var nodesToTest = Iterable.filterBy(
                featureNodes,
                statuses,
                function(status) {
                    return (
                        status === 'test-missing' ||
                        status === 'test-invalid'
                    );
                }
            );
            nodesToTest = nodesToTest.concat(jsenv.collectDependencies(nodesToTest));
            return build(
                nodesToTest.map(function(featureNode) {
                    return {
                        name: {
                            type: 'inline',
                            name: '',
                            from: featureNameFromNode(featureNode)
                        },
                        testDependencies: {
                            type: 'inline',
                            name: '',
                            from: featureNode.dependencies.map(function(dependency) {
                                return nodesToTest.indexOf(dependency);
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
function setAllTestRecord(records, agent) {
    return writeAllRecordToFileSystem(
        records,
        agent,
        'test'
    );
}
var noSolution = {
    match: featureHasNoFix
};
var inlineSolution = {
    match: featureUseInlineFix
};
var fileSolution = {
    match: featureUseFileFix,

    solve: function(features, abstractFeatures) {
        var filePaths = features.map(function(feature) {
            var fix = feature.fix;
            var fixValue = fix.value;

            var filePath;
            if (fixValue.indexOf('${rootFolder}') === 0) {
                filePath = fixValue.replace('${rootFolder}', rootFolder);
            } else {
                if (fixValue[0] === '.') {
                    throw new Error('solution path must be absolute');
                }
                filePath = path.resolve(
                    rootFolder,
                    fixValue
                );
            }
            return filePath;
        });
        filePaths.forEach(function(filePath, index) {
            var duplicatePathIndex = filePaths.indexOf(filePath, index);
            if (duplicatePathIndex > -1) {
                throw new Error(
                    'file path conflict between ' +
                    features[index].name +
                    ' and ' +
                    features[duplicatePathIndex].name
                );
            }
        });
        // console.log('filepaths', filePaths);
        return mapAsync(filePaths, function(filePath, index) {
            console.log('fetch file solution', filePath);
            return fsAsync.getFileContent(filePath).then(function(content) {
                return new Function(content); // eslint-disable-line no-new-func
            }).then(function(fileFunction) {
                var feature = features[index];
                var abstractFeature = Iterable.find(abstractFeatures, function(abstractFeature) {
                    return abstractFeature.name.from === feature.name;
                });
                abstractFeature.fixFunction = fileFunction;
            });
        });
    }
};
var coreJSSolution = {
    match: featureUseCoreJSFix,

    solve: function(features, abstractFeatures, options) {
        var moduleNames = features.map(function(feature) {
            var fix = feature.fix;
            return fix.value;
        });
        moduleNames.forEach(function(moduleName, index) {
            var duplicateIndex = moduleNames.indexOf(moduleName, index);
            if (duplicateIndex > -1) {
                throw new Error(
                    'corejs module conflict between ' +
                    features[index].name +
                    ' and ' +
                    features[duplicateIndex].name
                );
            }
        });

        function createCoreJSBuild() {
            var source = '';
            source = Iterable.reduce(features, function(previous, feature) {
                if (feature.fix.beforeFix) {
                    previous += '\n' + feature.fix.beforeFix;
                }
                return previous;
            }, source);
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
        }).then(function(coreJSFunction) {
            options.meta.coreJSFunction = coreJSFunction;
        });
    }
};
var babelSolution = {
    match: featureUseBabelFix,

    createTranspiler: function(features) {
        function createPluginOptions(fix) {
            var options = {};
            if ('config' in fix) {
                var config = fix.config;
                if (typeof config === 'object') {
                    jsenv.assign(options, fix);
                } else if (typeof config === 'function') {
                    jsenv.assign(options, config(features));
                }
            }
            return options;
        }

        var plugins = features.map(function(feature) {
            var fix = feature.fix;
            var name = fix.value;
            var options = createPluginOptions(fix);
            return {
                name: name,
                options: options
            };
        });
        plugins.forEach(function(plugin, index) {
            var duplicateIndex = Iterable.findIndex(
                plugins.slice(index + 1),
                function(nextPlugin) {
                    return nextPlugin.name === plugin.name;
                }
            );
            if (duplicateIndex > -1) {
                throw new Error(
                    'babel plugin conflict between ' +
                    features[index].name +
                    ' and ' +
                    features[duplicateIndex].name
                );
            }
        });

        var pluginsAsOptions = Iterable.map(plugins, function(plugin) {
            return [plugin.name, plugin.options];
        });
        var transpiler = createTranspiler({
            cache: true,
            cacheMode: 'default',
            plugins: pluginsAsOptions
        });
        return transpiler;
    },

    solve: function(features, abstractFeatures, options) {
        /*
        it may be the most complex thing involved here so let me explain
        we create a transpiler adapted to required features
        then we create a babel plugin which transpile template literals using that transpiler
        finally we create a transpiler which uses that plugin
        */
        var babelTranspiler = this.createTranspiler(features);
        var transpileTemplatePlugin = createTranspiler.transpileTemplateTaggedWith(function(code) {
            var result = babelTranspiler.transpile(code, {
                as: 'code',
                sourceMaps: false,
                sourceURL: false,
                // disable cache to prevent race condition with the transpiler
                // that will use this plugin (it's the parent transpiler which is reponsible to cache)
                cache: false
            });
            return result;
        }, 'transpile');
        var fixedTranspiler = transpiler.clone();
        fixedTranspiler.options.plugins.unshift(transpileTemplatePlugin);
        options.transpiler = fixedTranspiler;
        return Promise.resolve(fixedTranspiler);
    }
};
function featureHasNoFix(feature) {
    return feature.fix.type === 'none';
}
function featureUseInlineFix(feature) {
    return feature.fix.type === 'inline';
}
function featureUseFileFix(feature) {
    return feature.fix.type === 'file';
}
function featureUseCoreJSFix(feature) {
    return feature.fix.type === 'corejs';
}
function featureUseBabelFix(feature) {
    return feature.fix.type === 'babel';
}
function filterBySolution(features, solution, abstractFeatures) {
    var i = 0;
    var j = features.length;
    var matches = [];
    while (i < j) {
        var feature = features[i];
        var existingFix = Iterable.find(matches, function(match) { // eslint-disable-line
            return match.fix === feature.fix;
        });
        if (existingFix) {
            // remove ducplicate fix from abstractFeatures (no need to fix them)
            if (abstractFeatures) {
                abstractFeatures.split(i, 1);
            }
            features.splice(i, 1);
            j--;
        } else if (solution.match(feature)) {
            matches.push(feature);
            features.splice(i, 1);
            j--;
        } else {
            i++;
        }
    }
    return matches;
}
function groupBySolution(features, abstractFeatures) {
    var remaining = features.slice();
    var groups = {
        inline: filterBySolution(remaining, inlineSolution, abstractFeatures),
        file: filterBySolution(remaining, fileSolution, abstractFeatures),
        corejs: filterBySolution(remaining, coreJSSolution, abstractFeatures),
        babel: filterBySolution(remaining, babelSolution, abstractFeatures),
        none: filterBySolution(remaining, noSolution, abstractFeatures),
        remaining: remaining
    };
    return groups;
}
function loadTestIntoAbstract(nodes, abstractFeatures) {
    var dependencies = jsenv.collectDependencies(nodes);
    var featureNamesToTest = nodes.concat(dependencies).map(featureNameFromNode);
    return getNodes(
        featureNamesToTest,
        'test'
    ).then(function(testNodes) {
        var abstractFeaturesHavingTest = testNodes.map(function(testNode) {
            var featureName = featureNameFromNode(testNode);
            var abstractFeature = Iterable.find(abstractFeatures, function(abstractFeature) {
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

            if (abstractFeature) {
                abstractFeature.test = abstractTestProperty;
                abstractFeature.testDependencies = abstractTestDependenciesProperty;
            } else {
                abstractFeature = {
                    name: {
                        type: 'inline',
                        name: '',
                        from: featureName
                    },
                    test: abstractTestProperty,
                    testDependencies: abstractTestDependenciesProperty
                };
                abstractFeatures.push(abstractFeature);
            }
            return abstractFeature;
        });

        abstractFeaturesHavingTest.forEach(function(abstractFeature, index) {
            var testNode = testNodes[index];
            abstractFeature.testDependencies.from = testNode.dependencies.map(function(dependency) {
                var dependencyAsFeatureName = featureNameFromNode(dependency);
                return Iterable.findIndex(abstractFeatures, function(abstractFeature) {
                    return abstractFeature.name.from === dependencyAsFeatureName;
                });
            });
        });
    });
}
function getNodesMatchingStatus(featureNames, agent, options) {
    return getNodes(featureNames, 'fix').then(function(nodes) {
        return mapAsync(nodes, function(node) {
            var featureName = featureNameFromNode(node);
            return getStatus(
                featureName,
                agent,
                true,
                options.inheritClosestStatus
            );
        }).then(function(statuses) {
            if (options.ensure) {
                options.ensure(nodes, statuses);
            }

            return Iterable.filterBy(
                nodes,
                statuses,
                options.include
            );
        });
    });
}
function getFeaturesMatching(featureNames, agent, options) {
    return getNodesMatchingStatus(
        featureNames,
        agent,
        options
    ).then(function(nodes) {
        var abstractFeatures = nodes.map(function(node) {
            return {
                name: {
                    type: 'inline',
                    name: '',
                    from: featureNameFromNode(node)
                },
                fix: {
                    type: 'import',
                    name: 'default',
                    from: './' + featureNameFromNode(node) + '/fix.js'
                },
                fixDependencies: {
                    type: 'inline',
                    name: '',
                    from: node.dependencies.filter(function(dependency) {
                        return Iterable.includes(nodes, dependency);
                    }).map(function(dependency) {
                        return nodes.indexOf(dependency);
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
        }).then(function(data) {
            return data.features;
        }).then(function(features) {
            return {
                nodes: nodes,
                abstractFeatures: abstractFeatures,
                features: features
            };
        });
    });
}
function getFixInstructions(featureNames, agent) {
    var matchOptions = {
        ensure: function(nodes, statuses) {
            var problematicNodes = Iterable.filterBy(
                nodes,
                statuses,
                function(status) {
                    return (
                        status === 'test-missing' ||
                        status === 'test-invalid'
                    );
                }
            );
            if (problematicNodes.length) {
                var problems = {};
                problematicNodes.forEach(function(node, index) {
                    problems[featureNameFromNode(node)] = statuses[index];
                });
                throw new Error(
                    'some test status prevent fix: ' + require('util').inspect(problems)
                );
            }
        },
        include: function(status) {
            return (
                status === 'test-failed-and-fix-missing' ||
                status === 'test-failed-and-fix-invalid'
            );
        }
    };

    return getFeaturesMatching(
        featureNames,
        agent,
        matchOptions
    ).then(function(match) {
        var nodesToFix = match.nodes;
        var abstractFeatures = match.abstractFeatures;
        var featuresToFix = match.features;
        var groups = groupBySolution(featuresToFix, abstractFeatures);
        var buildOptions = {
            root: getFolder(),
            transpiler: transpiler,
            meta: {}
        };
        var pending = [];

        var fileFeatures = groups.file;
        var fileSolutionThenable = fileSolution.solve(
            fileFeatures,
            abstractFeatures,
            buildOptions
        );
        pending.push(fileSolutionThenable);

        var coreJSFeatures = groups.corejs;
        var coreJSSolutionThenable = coreJSSolution.solve(
            coreJSFeatures,
            abstractFeatures,
            buildOptions
        );
        pending.push(coreJSSolutionThenable);

        var babelFeatures = groups.babel;
        var babelSolutionThenable = babelSolution.solve(
            babelFeatures,
            abstractFeatures,
            buildOptions
        );
        pending.push(babelSolutionThenable);

        var loadTestThenable = loadTestIntoAbstract(
            nodesToFix,
            abstractFeatures,
            buildOptions
        );
        pending.push(loadTestThenable);

        return Thenable.all(pending).then(function() {
            return build(
                abstractFeatures,
                buildOptions
            ).then(function(bundle) {
                return bundle.source;
            });
        });
    });
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

function createOwnMediator(featureNames, agent) {
    agent = Agent.parse(agent);

    return {
        send: function(action, value) {
            if (action === 'getTestInstructions') {
                return getTestInstructions(featureNames, agent).then(fromServer);
            }
            if (action === 'setAllTestRecord') {
                return setAllTestRecord(value, agent);
            }
            if (action === 'getFixInstructions') {
                return getFixInstructions(featureNames, agent).then(fromServer);
            }
            if (action === 'setAllFixRecord') {
                return setAllFixRecord(value, agent);
            }
            throw new Error('unknown mediator action ' + action);
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
}
var ownMediator = createOwnMediator(
    [
        // 'promise/unhandled-rejection',
        // 'promise/rejection-handled'
        // 'const/scoped'
        'const/scoped'
    ],
    String(jsenv.agent)
);
var client = jsenv.createImplementationClient(ownMediator);
client.fix().then(function() {
    console.log('ok');
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

function getClosestAgentForFeature(featureName, agent) {
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
//     'const',
//     jsenv.createAgent('node/4.7.4')
// ).then(function(agent) {
//     console.log('agent', agent.toString());
// }).catch(function(e) {
//     console.log('rejected with', e);
// });

var clientMatchOptions = {
    inheritClosestStatus: true,
    // ensure: function(nodes, statuses) {
    //     var featureWithFailedTestAndFailedFix = Iterable.filterBy(
    //         nodes,
    //         statuses,
    //         function(status) {
    //             return status === 'test-failed-and-fix-failed';
    //         }
    //     );
    //     je ne suis pas sur qu'on va throw
    //     on va ptet juste ne rien faire parce qu'on sait que ca créé une erreur plutot
    //     if (featureWithFailedTestAndFailedFix.length) {
    //         throw new Error('unfixable features ' + featureWithFailedTestAndFailedFix);
    //     }
    // },
    include: function(status) {
        return (
            status === 'test-missing' ||
            status === 'test-invalid' ||
            status === 'test-failed-and-fix-missing' ||
            status === 'test-failed-and-fix-invalid' ||
            status === 'test-failed-and-fix-passed'
        );
    }
};
function getPolyfillInstructions(featureNames, agent) {
    var matchOptions = clientMatchOptions;

    return getFeaturesMatching(
        featureNames,
        agent,
        matchOptions
    ).then(function(match) {
        var abstractFeatures = match.abstractFeatures;
        var featuresToFix = match.features;
        var groups = groupBySolution(featuresToFix, abstractFeatures);
        var buildOptions = {
            root: getFolder(),
            transpiler: transpiler,
            footer: 'jsenv.polyfill(__exports__);',
            meta: {}
        };
        // console.log('the features', featuresToFix);

        var pending = [];

        var fileFeatures = groups.file;
        var fileSolutionThenable = fileSolution.solve(
            fileFeatures,
            abstractFeatures,
            buildOptions
        );
        pending.push(fileSolutionThenable);

        var coreJSFeatures = groups.corejs;
        var coreJSSolutionThenable = coreJSSolution.solve(
            coreJSFeatures,
            abstractFeatures,
            buildOptions
        );
        pending.push(coreJSSolutionThenable);

        return Thenable.all(pending).then(function() {
            return build(
                abstractFeatures,
                buildOptions
            ).then(function(bundle) {
                return bundle.source;
            });
        });
    });
}
// getPolyfillInstructions(
//     ['object/assign'],
//     jsenv.agent
// ).then(function(polyfill) {
//     eval(polyfill);
//     console.log(Object.assign);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function transpile(path, featureNames, agent) {
    return getNodesMatchingStatus(
        featureNames,
        agent,
        clientMatchOptions
    ).then(function(match) {
        var featuresToFix = match.features;
        var groups = groupBySolution(featuresToFix);
        var transpiler = babelSolution.createTranspiler(groups.babel);
        return transpiler.transpileFile(path);
    });
}
// transpile(
//     './test.js',
//     [
//         'const/scoped'
//     ]
// ).then(function(content) {
//     console.log('transpilation result', content);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

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
api.getPolyfillInstructions = getPolyfillInstructions;
api.transpile = transpile;
api.createOwnMediator = createOwnMediator;

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
