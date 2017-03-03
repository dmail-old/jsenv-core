/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- minification
pouvoir minifier polyfill.js
ca fera partie des options de api.polyfill et api.transpile

- sourcemap
écrire le fichier sourceMap a coté du fichier concerné pour polyfill.js
et pour tous les fichier transpilé

- produire test-output.json de chaque feature une après l'autre pour node 0.12
- puis faire pareil avec fix-output.json

- implémenter test.children & test.dependentChildren (cf destructuring/test.js)

*/

var path = require('path');

require('../jsenv.js');
var Agent = require('../agent/agent.js');
var store = require('../store/store.js');
var fsAsync = require('../fs-async.js');
var memoize = require('../memoize.js');
var createTranspiler = require('../transpiler/transpiler.js');

var rootFolder = path.resolve(__dirname, '../../').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var corejsCacheFolder = cacheFolder + '/corejs';
var polyfillCacheFolder = cacheFolder + '/polyfill';

var readDependencies = require('./read-module-dependencies.js');

var Iterable = jsenv.Iterable;
var Thenable = jsenv.Thenable;

var getFolder = require('./get-folder.js');
function pathFromId(featureId) {
    return getFolder() + '/' + featureId;
}
function idFromNode(node) {
    var relative = node.id.slice(getFolder().length + 1);
    return jsenv.parentPath(relative);
}
var listAll = require('./list-all.js');
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
function createTestOutputProperties(featureId, agent) {
    var agentString = agent.toString();
    var featureFolderPath = pathFromId(featureId);
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        path: featureAgentCachePath,
        name: 'test-output.json',
        encode: stringify,
        sources: [
            {
                path: featureFolderPath + '/test.js',
                strategy: 'eTag'
            }
        ],
        // mode: 'write-only'
        mode: 'default'
    };
    return properties;
}
function createFixOutputProperties(featureId, agent) {
    var agentString = agent.toString();
    var featureFolderPath = pathFromId(featureId);
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        path: featureAgentCachePath,
        name: 'fix-output.json',
        encode: stringify,
        sources: [
            {
                path: featureFolderPath + '/fix.js',
                strategy: 'eTag'
            }
        ],
        mode: 'write-only'
        // mode: 'default'
    };
    return properties;
}
function readOutputFromFileSystem(featureId, agent, createProperties) {
    var cache = getFeatureAgentCache(featureId, agent, createProperties);
    return cache.read();
}
function getFeatureAgentCache(featureId, agent, createProperties) {
    var properties = createProperties(featureId, agent);
    return store.fileSystemEntry(properties);
}
function readRecordFromFileSystem(featureId, agent, type) {
    var createProperties;
    if (type === 'test') {
        createProperties = createTestOutputProperties;
    } else {
        createProperties = createFixOutputProperties;
    }

    return readOutputFromFileSystem(
        featureId,
        agent,
        createProperties
    ).then(function(data) {
        if (data.valid) {
            console.log('got valid data for', featureId);
        } else {
            console.log('no valid for', featureId, 'because', data.reason);
        }

        return {
            id: featureId,
            data: data
        };
    });
}
function recordIsMissing(record) {
    return (
        record.data.valid === false &&
        record.data.reason === 'file-not-found'
    );
}
function recordIsInvalid(record) {
    return record.data.valid === false;
}
function recordIsFailed(record) {
    return record.data.value.status === 'failed';
}
function getStatus(featureId, agent, includeFix, enableClosestAgent) {
    var featureAgentPromise;
    if (enableClosestAgent) {
        featureAgentPromise = getClosestAgentForFeature(featureId, agent);
    } else {
        featureAgentPromise = Promise.resolve(agent);
    }
    return featureAgentPromise.then(
        function(featureAgent) {
            return readRecordFromFileSystem(
                featureId,
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
                            featureId,
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
function getAllDependencies(featureIds, file) {
    var featureTests = featureIds.map(function(featureId) {
        return './' + featureId + '/' + file;
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
                return path.basename(id) !== file;
            },
            autoParentDependency: function(id) {
                if (file === 'fix.js') {
                    return;
                }
                // si id est dans folderPath mais n'est pas un enfant direct de folderPath
                // folderPath/a/file.js non
                // mais folderpath/a/b/file.js oui et on renvoit folderpath/a/file.js
                // seulement si mode === 'test' ?

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
                var possibleParentFile = folderPath + '/' + relativeParts.slice(0, -2) + '/' + file;
                return fsAsync.visible(possibleParentFile).then(
                    function() {
                        return possibleParentFile;
                    },
                    function() {
                        return null;
                    }
                );
            }
        }
    );
}
function getNodes(featureIds, file) {
    return getAllDependencies(featureIds, file).then(function(nodes) {
        return nodes.concat(jsenv.collectDependencies(nodes));
    });
}
function matchNodes(featureIds, agent, options) {
    return getNodes(featureIds, options.file).then(function(nodes) {
        return mapAsync(nodes, function(node) {
            var featureId = idFromNode(node);
            console.log('get status of', featureId);
            return getStatus(
                featureId,
                agent,
                options.needFixStatus,
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
function getTestInstructions(featureIds, agent) {
    return matchNodes(
        featureIds,
        agent,
        {
            file: 'test.js',
            include: function(status) {
                return (
                    status === 'test-missing' ||
                    status === 'test-invalid'
                );
            }
        }
    ).then(function(nodes) {
        var nodesToTest = nodes.concat(jsenv.collectDependencies(nodes));
        var abstractFeatures = nodesToTest.map(function(featureNode) {
            var featureId = idFromNode(featureNode);
            return {
                id: {
                    type: 'inline',
                    name: '',
                    from: featureId
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
                    from: './' + featureId + '/test.js'
                }
            };
        });
        return build(
            abstractFeatures,
            {
                transpiler: transpiler,
                root: getFolder()
            }
        ).then(function(bundle) {
            return bundle.source;
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
            record.id,
            agent,
            createProperties,
            record.data
        ).then(function() {
            return undefined;
        });
    });
    return Thenable.all(outputsPromises);
}
function writeOutputToFileSystem(featureId, agent, createProperties, output) {
    var cache = getFeatureAgentCache(featureId, agent, createProperties);
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

    resolvePath: function(feature) {
        var fix = feature.fix;
        var fixValue = fix.value;
        if (fixValue.indexOf('${rootFolder}') === 0) {
            fixValue = fixValue.replace('${rootFolder}', rootFolder);
        }
        var featurePath = pathFromId(feature.id);
        return path.resolve(
            featurePath,
            fixValue
        ).replace(/\\/g, '/');
    },

    solve: function(features, abstractFeatures) {
        var filePaths = features.map(function(feature) {
            return fileSolution.resolvePath(feature);
        });
        filePaths.forEach(function(filePath, index) {
            var duplicatePathIndex = filePaths.indexOf(filePath, index + 1);
            if (duplicatePathIndex > -1) {
                throw new Error(
                    'file path conflict between ' +
                    features[index].id +
                    ' and ' +
                    features[duplicatePathIndex].id
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
                    return abstractFeature.id.from === feature.id;
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
            var duplicateIndex = moduleNames.indexOf(moduleName, index + 1);
            if (duplicateIndex > -1) {
                throw new Error(
                    'corejs module conflict between ' +
                    features[index].id +
                    ' and ' +
                    features[duplicateIndex].id
                );
            }
        });
        var banner = Iterable.reduce(features, function(previous, feature) {
            if (feature.fix.beforeFix) {
                previous += '\n' + feature.fix.beforeFix;
            }
            return previous;
        }, '');

        function createCoreJSBuild(moduleNames, banner) {
            var source = '';
            if (banner) {
                source += banner + '\n';
            }

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
            return Promise.resolve(source);
        }

        var memoized = memoize.async(
            createCoreJSBuild,
            store.fileSystemEntry(
                {
                    normalize: function(moduleNames, banner) {
                        return {
                            modules: moduleNames,
                            banner: banner
                        };
                    },
                    path: corejsCacheFolder,
                    name: 'build.js'
                }
            )
        );
        return memoized(moduleNames, banner).then(function(source) {
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
                    features[index].id +
                    ' and ' +
                    features[duplicateIndex].id
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
    var featureIdsToTest = nodes.concat(dependencies).map(idFromNode);
    return getNodes(
        featureIdsToTest,
        'test.js'
    ).then(function(testNodes) {
        var abstractFeaturesHavingTest = testNodes.map(function(testNode) {
            var featureId = idFromNode(testNode);
            var abstractFeature = Iterable.find(abstractFeatures, function(abstractFeature) {
                return abstractFeature.id.from === featureId;
            });
            var abstractTestProperty = {
                type: 'import',
                name: 'default',
                from: './' + featureId + '/test.js'
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
                    id: {
                        type: 'inline',
                        name: '',
                        from: featureId
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
                var dependencyAsFeatureId = idFromNode(dependency);
                return Iterable.findIndex(abstractFeatures, function(abstractFeature) {
                    return abstractFeature.id.from === dependencyAsFeatureId;
                });
            });
        });
    });
}
function matcher(featureIds, agent, options) {
    return matchNodes(
        featureIds,
        agent,
        options
    ).then(function(nodes) {
        var abstractFeatures = nodes.map(function(node) {
            var featureId = idFromNode(node);
            return {
                id: {
                    type: 'inline',
                    name: '',
                    from: featureId
                },
                fix: {
                    type: 'import',
                    name: 'default',
                    from: './' + featureId + '/fix.js'
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
function getFixInstructions(featureIds, agent) {
    var matchOptions = {
        file: 'fix.js',
        needFixStatus: true,
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
                    problems[idFromNode(node)] = statuses[index];
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

    return matcher(
        featureIds,
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
//     ['object/assign'],
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

function createOwnMediator(featureIds, agent) {
    agent = Agent.parse(agent);

    return {
        send: function(action, value) {
            if (action === 'getTestInstructions') {
                return getTestInstructions(featureIds, agent).then(fromServer);
            }
            if (action === 'setAllTestRecord') {
                return setAllTestRecord(value, agent);
            }
            if (action === 'getFixInstructions') {
                return getFixInstructions(featureIds, agent).then(fromServer);
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
// var ownMediator = createOwnMediator(
//     [
//         // 'promise/unhandled-rejection',
//         // 'promise/rejection-handled'
//         // 'const/scoped'
//         'const/scoped'
//     ],
//     String(jsenv.agent)
// );
// var client = jsenv.createImplementationClient(ownMediator);
// client.fix().then(function() {
//     console.log('ok');
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function getClosestAgentForFeature(featureId, agent) {
    var featureFolderPath = pathFromId(featureId);
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
            featureId: featureId,
            agentName: agent.name
        };
        return missing;
    }
    function missingVersion() {
        var missing = {
            code: 'NO_AGENT_VERSION',
            featureId: featureId,
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

var clientMatcherOptions = {
    file: 'fix.js',
    needFixStatus: true,
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
function polyfill(featureIds, agent, minify) {
    var matchOptions = clientMatcherOptions;

    return matcher(
        featureIds,
        agent,
        matchOptions
    ).then(function(match) {
        var abstractFeatures = match.abstractFeatures;
        var featuresToFix = match.features;
        var groups = groupBySolution(featuresToFix, abstractFeatures);
        var buildOptions = {
            root: getFolder(),
            transpiler: minify ? transpiler.minify() : transpiler,
            minify: minify,
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
            var sources = abstractFeatures.map(function(abstractFeature) {
                return {
                    path: pathFromId(abstractFeature.id.from) + '/fix.js',
                    strategy: 'mtime'
                };
            });
            fileFeatures.forEach(function(feature) {
                sources.push({
                    path: fileSolution.resolvePath(feature),
                    strategy: 'mtime'
                });
            });
            var entry = store.fileSystemEntry({
                path: polyfillCacheFolder,
                name: 'polyfill.js',
                behaviour: 'branch',
                mode: 'write-only',
                normalize: function(abstractFeatures) {
                    return {
                        features: abstractFeatures.map(function(abstractFeature) {
                            return abstractFeature.id.from;
                        })
                    };
                },
                sources: sources
            });
            return entry.get(abstractFeatures).then(function(data) {
                if (data.valid) {
                    return data.path;
                }
                return build(
                    abstractFeatures,
                    buildOptions
                ).then(function(bundle) {
                    return entry.set(bundle.source, abstractFeatures).then(function(data) {
                        return data.path;
                    });
                });
            });
        });
    });
}
polyfill(
    ['object/assign'],
    jsenv.agent,
    true
).then(function(polyfill) {
    eval(String(require('fs').readFileSync(polyfill)));
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

function transpile(file, featureIds, agent) {
    file = path.resolve(file).replace(/\\/g, '/');

    return matcher(
        featureIds,
        agent,
        clientMatcherOptions
    ).then(function(match) {
        var featuresToFix = match.features;
        var groups = groupBySolution(featuresToFix);
        var transpiler = babelSolution.createTranspiler(groups.babel);
        return transpiler.transpileFile(file, {
            onlyPath: true
        });
    });
}
// transpile(
//     './test.js',
//     [
//         'const/scoped'
//     ],
//     jsenv.agent
// ).then(function(file) {
//     console.log('transpiled file', file);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function createBrowserMediator(featureIds) {
    return {
        send: function(action, value) {
            if (action === 'getTestInstructions') {
                return get(
                    'test?features=' + featureIds.join(encodeURIComponent(','))
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
                    'fix?features=' + featureIds.join(encodeURIComponent(','))
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
api.getFeaturePath = pathFromId;
api.getClosestAgent = getClosestAgentForFeature;
api.listAll = listAll;
api.build = build;
api.transpiler = transpiler;
api.getTestInstructions = getTestInstructions;
api.getFixInstructions = getFixInstructions;
api.polyfill = polyfill;
api.transpile = transpile;
api.createOwnMediator = createOwnMediator;

module.exports = api;
