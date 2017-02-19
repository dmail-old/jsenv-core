/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

*/

require('../jsenv.js');
var path = require('path');
var Iterable = jsenv.Iterable;
var Predicate = jsenv.Predicate;
var fsAsync = require('../fs-async.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var rootFolder = path.resolve(__dirname, '../..').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var featuresFolderPath = rootFolder + '/src/features';
var polyfillFolder = cacheFolder + '/polyfill';
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
var noSolution = {
    match: function(feature) {
        return feature.solution === 'none' || !feature.solution;
    }
};
var polyfillSolution = {
    match: function(feature) {
        return (
            feature.solution.type === 'corejs' ||
            feature.solution.type === 'file'
        );
    },

    solve: function(entriesUsingPolyfillSolution) {
        var entriesUsingCoreJS = entriesUsingPolyfillSolution.filter(function(entry) {
            return entry.feature.solution.type === 'corejs';
        });
        var entriesUsingFile = entriesUsingPolyfillSolution.filter(function(entry) {
            return entry.feature.solution.type === 'file';
        });
        var coreJSModules = Iterable.uniq(entriesUsingCoreJS.map(function(entry) {
            return entry.feature.solution.value;
        }));
        var files = Iterable.uniq(entriesUsingFile.map(function(entry) {
            return require('path').resolve(
                featuresFolderPath + '/' + entry.feature.name + '/feature.js',
                entry.feature.solution.value.replace('${rootFolder}', rootFolder)
            );
        }));

        function createPolyfill() {
            function createCoreJSPolyfill() {
                var source = '';

                // Iterable.forEach(requiredCoreJSModules, function(module) {
                //     if (module.prefixCode) {
                //         source += module.prefixCode;
                //     }
                // });
                var sourcePromise = Promise.resolve(source);
                console.log('concat corejs modules', coreJSModules);

                return sourcePromise.then(function(source) {
                    if (coreJSModules.length) {
                        var buildCoreJS = require('core-js-builder');
                        var promise = buildCoreJS({
                            modules: coreJSModules,
                            librabry: false,
                            umd: true
                        });
                        return promise.then(function(polyfill) {
                            if (source) {
                                source += '\n';
                            }
                            source += polyfill;

                            return source;
                        });
                    }
                    return source;
                });
            }
            function createOwnFilePolyfill() {
                console.log('concat files', files);

                var sourcesPromises = Iterable.map(files, function(filePath) {
                    return fsAsync.getFileContent(filePath);
                });
                return Promise.all(sourcesPromises).then(function(sources) {
                    return sources.join('\n\n');
                });
            }

            return Promise.all([
                createCoreJSPolyfill(),
                createOwnFilePolyfill()
            ]).then(function(sources) {
                return sources.join('');
            });
        }

        var polyfillCache = store.fileSystemCache(polyfillFolder);
        return polyfillCache.match({
            solutions: {
                files: files,
                corejs: coreJSModules
            }
        }).then(function(cacheBranch) {
            return memoize.async(
                createPolyfill,
                cacheBranch.entry({
                    name: 'polyfill.js',
                    sources: files.map(function(filePath) {
                        return {
                            path: filePath,
                            strategy: 'mtime'
                        };
                    })
                })
            )();
        });
    }
};
var transpileSolution = {
    match: function(feature) {
        return feature.solution.type === 'babel';
    },

    solve: function(entriesUsingTranspileSolution) {
        var requiredPlugins = entriesUsingTranspileSolution.map(function(entry) {
            var solution = entry.feature.solution;
            var createOptions = function() {
                var options = {};
                if ('config' in solution) {
                    var config = solution.config;
                    if (typeof config === 'object') {
                        jsenv.assign(options, config);
                    } else if (typeof config === 'function') {
                        jsenv.assign(options, config(entriesUsingTranspileSolution));
                    }
                }
                return options;
            };

            return {
                name: solution.value,
                options: createOptions()
            };
        });
        var pluginsAsOptions = Iterable.map(requiredPlugins, function(plugin) {
            return [plugin.name, plugin.options];
        });
        return createTranspiler({
            cache: true,
            cacheMode: 'default',
            plugins: pluginsAsOptions
        });
    }
};
function getTestOutputEntryProperties(feature) {
    var entryProperties = {
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
        encode: function(value) {
            return JSON.stringify(value, stringifyErrorReplacer, '\t');
        },
        cacheMode: 'write-only',
        sources: sources
    };
    return entryProperties;
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
var entryIsEnabled = function(entry) {
    return entry.enabled;
};
var entryFeatureMatching = function(entry, otherEntry) {
    return entry.feature.match(otherEntry.feature.name);
};
var entryTestIsMissing = Predicate.every(entryIsEnabled, function(entry) {
    return entry.testOutput === undefined;
});
var entryTestHasCrashed = Predicate.every(entryIsEnabled, function(entry) {
    return entry.testOutput.status === 'crashed';
});
var entryTestHasFailed = Predicate.every(entryIsEnabled, function(entry) {
    return entry.testOutput.detail.status === 'invalid';
});
var entryFixIsMissing = Predicate.every(entryTestHasFailed, function(entry) {
    return entry.fixOutput === undefined;
});
var entryFixHasCrashed = Predicate.every(entryTestHasFailed, function(entry) {
    return entry.fixOutput.status === 'crashed';
});
var entryFixHasFailed = Predicate.every(entryTestHasFailed, function(entry) {
    return entry.fixOutput.detail.status === 'invalid';
});
function markEntryTestAsRequired(entry) {
    entry.mustBeTested = true;
}
function markEntryFixAsRequired(entry) {
    entry.mustBeFixed = true;
}
function cleanDormant(entries, filteredEntries) {
    // the code below is just for pef
    var dormantEntries;
    if (filteredEntries) {
        dormantEntries = entries.filter(function(entry) {
            // si la feature n'est pas dans ce groupe et que ce n'est pas une dépendance
            return (
                Iterable.includes(filteredEntries, entry) === false &&
                filteredEntries.every(function(filteredEntry) {
                    return entry.feature.isDependentOf(filteredEntry.feature) === false;
                })
            );
        });
    } else {
        dormantEntries = entries;
    }
    dormantEntries.forEach(function(entry) {
        delete entry.source;
    });
}
function getNextInstruction(instruction) {
    var options = {
        agent: 'firefox/50.0.0',
        features: []
    };
    jsenv.assign(options, instruction.options || {});

    return getEntries(options.features).then(function(entries) {
        if (instruction.name !== 'start') {
            instruction.entries.forEach(function(instructionEntry) {
                var entry = Iterable.find(entries, function(entry) {
                    return entryFeatureMatching(entry, instructionEntry);
                });
                if (entry) {
                    entry.testOutput = instructionEntry.testOutput;
                    entry.fixOutput = instructionEntry.fixOutput;
                }
            });
        }

        var entriesEnabled = entries.filter(entryIsEnabled);
        return harmonizeEntriesWithFileSystem(
            entriesEnabled,
            'testOutput',
            {
                agent: options.agent,
                createEntryProperties: getTestOutputEntryProperties
            }
        ).then(function() {
            var entriesWithoutTest = entries.filter(entryTestIsMissing);
            if (entriesWithoutTest.length) {
                if (instruction.name === 'start') {
                    entriesWithoutTest.forEach(markEntryTestAsRequired);
                    cleanDormant(entries, entriesWithoutTest);
                    return {
                        name: 'test',
                        reason: 'some-test-output-are-required',
                        detail: {
                            entries: entries
                        }
                    };
                }
                return {
                    name: 'fail',
                    reason: 'some-test-output-are-missing',
                    detail: {
                        entries: entries
                    }
                };
            }

            var entriesWithCrashedTest = entries.filter(entryTestHasCrashed);
            if (entriesWithCrashedTest.length) {
                return {
                    name: 'fail',
                    reason: 'some-test-have-crashed',
                    detail: {
                        entries: entries
                    }
                };
            }
            var entriesWithFailedTest = entries.filter(entryTestHasFailed);
            entriesWithFailedTest.forEach(markEntryFixAsRequired);
            var solutions = [noSolution, polyfillSolution, transpileSolution];
            var remainingEntriesWithFailedTest = entriesWithFailedTest;
            var solutionsEntries = solutions.map(function(solution) {
                var half = Iterable.bisect(remainingEntriesWithFailedTest, function(entry) {
                    return solution.match(entry.feature);
                });
                remainingEntriesWithFailedTest = half[1];
                return half[0];
            });
            var entriesWithoutSolution = solutionsEntries[0];
            var entriesUsingPolyfillSolution = solutionsEntries[1];
            var entriesUsingTranspileSolution = solutionsEntries[2];
            if (entriesWithoutSolution.length) {
                return {
                    name: 'fail',
                    reason: 'some-feature-have-no-solution',
                    detail: {
                        entries: entries
                    }
                };
            }
            if (remainingEntriesWithFailedTest.length) {
                return {
                    name: 'fail',
                    reason: 'some-solution-are-unknown',
                    detail: {
                        entries: entries
                    }
                };
            }

            var isBeforeFixInstruction = instruction.name === 'start' || instruction.name === 'test';
            var fixSourcePromise;
            if (isBeforeFixInstruction) {
                fixSourcePromise = polyfillSolution.solve(entriesUsingPolyfillSolution);
            } else if (instruction.name === 'fix') {
                fixSourcePromise = Promise.resolve('');
            }

            var harmonizeFixPromise = harmonizeEntriesWithFileSystem(
                entriesWithFailedTest,
                'fixOutput',
                {
                    agent: options.agent,
                    createEntryProperties: getFixOutputEntryProperties
                }
            );

            return Promise.all([
                fixSourcePromise,
                harmonizeFixPromise
            ]).then(function(data) {
                var fixSource = data[0];
                var entriesWithoutFix = entries.filter(entryFixIsMissing);
                entriesWithoutFix.forEach(markEntryTestAsRequired);

                if (entriesWithoutFix.length) {
                    if (isBeforeFixInstruction) {
                        /*
                        it may be the most complex thing involved here so let me explain
                        we create a transpiler adapted to required features
                        then we create a babel plugin which transpile template literals using that transpiler
                        finally we create a transpiler which uses that plugin
                        */
                        var transpiler = transpileSolution.solve(entriesUsingTranspileSolution);
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
                        return readFeatureSourcesFromFolder(
                            entriesWithoutFix,
                            featuresFolderPath,
                            fixedFeatureTranspiler
                        ).then(function() {
                            // normalement faudrais aussi ne pas clean toutes les
                            // entriesWithFailedTest
                            cleanDormant(entries, entriesWithoutFix);
                            return {
                                name: 'fix',
                                reason: 'some-fix-output-are-required',
                                detail: {
                                    entries: entries,
                                    fixSource: fixSource
                                }
                            };
                        });
                    }
                    return {
                        name: 'fail',
                        reason: 'some-fix-output-are-missing',
                        detail: {
                            entries: entries
                        }
                    };
                }

                var entriesWithCrashedFix = entries.filter(entryFixHasCrashed);
                if (entriesWithCrashedFix.length) {
                    return {
                        name: 'fail',
                        reason: 'some-fix-have-crashed',
                        detail: {
                            entries: entries
                        }
                    };
                }

                var entriesWithFailedFix = entries.filter(entryFixHasFailed);
                if (entriesWithFailedFix.length) {
                    return {
                        name: 'fail',
                        reason: 'some-solution-are-invalid',
                        detail: {
                            entries: entries
                        }
                    };
                }

                if (isBeforeFixInstruction && fixSource) {
                    cleanDormant(entries, entriesWithFailedTest);
                    return {
                        name: 'fix',
                        reason: 'some-fix-are-required',
                        detail: {
                            entries: entries,
                            fixSource: fixSource
                        }
                    };
                }

                return {
                    name: 'complete',
                    reason: 'all-feature-are-ok',
                    detail: {
                        entries: entries
                    }
                };
            });
        });
    });
}
function harmonizeEntriesWithFileSystem(entries, outputName, options) {
    var entriesHarmonizationPromises = entries.map(function(entry) {
        return harmonizeEntry(entry, options);
    });
    return Promise.all(entriesHarmonizationPromises);

    function harmonizeEntry(entry, options) {
        var output = entry[outputName];
        if (output) {
            return writeOutputToFileSystem(
                entry.feature,
                output,
                options.agent,
                options.createEntryProperties
            );
        }
        return readOutputFromFileSystem(
            entry.feature,
            options.agent,
            options.createEntryProperties
        ).then(function(output) {
            entry[outputName] = output;
        });
    }
    function readOutputFromFileSystem(feature, agent, createEntryProperties) {
        return getFeatureAgentCache(feature, agent).then(function(featureAgentCache) {
            var entryProperties = createEntryProperties(feature);
            return featureAgentCache.entry(entryProperties);
        }).then(function(entry) {
            return entry.read();
        }).then(function(data) {
            if (data.valid) {
                return data.value;
            }
            return undefined;
        });
    }
    function writeOutputToFileSystem(feature, output, agent, createEntryProperties) {
        return getFeatureAgentCache(feature, agent).then(function(featureAgentCache) {
            var entryProperties = createEntryProperties(feature);
            return featureAgentCache.entry(entryProperties);
        }).then(function(entry) {
            return entry.write(output);
        });
    }
    function getFeatureAgentCache(feature, agent) {
        var featureCacheFolderPath = featuresFolderPath + '/' + feature.name + '/.cache';
        var agentString = agent.toString();
        var featureCache = store.fileSystemCache(featureCacheFolderPath, {
            createBranchName: function(agentString) {
                return agentString;
            },
            matchBranch: function(branch, agentString) {
                return branch.name === agentString;
            }
        });
        return featureCache.match(agentString);
    }
}
function getEntries(names) {
    return getEntriesFromFileSystem().then(function(entries) {
        jsenv.reviveFeatureEntries(entries);
        return entries;
    }).then(function(entries) {
        if (names && names.length) {
            var half = Iterable.bisect(entries, isRequired);
            var toEnable = half[0];
            var toDisable = half[1];

            toDisable.forEach(function(entry) {
                entry.feature.disable();
            });
            toEnable.forEach(function(entry) {
                entry.feature.enable();
            });
        }
        entries.forEach(function(entry) {
            if (entry.feature.isEnabled()) {
                entry.enabled = true;
            }
        });
        return entries;
    });

    function isRequired(entry) {
        return jsenv.Iterable.some(names, function(name) {
            return entry.feature.match(name);
        });
    }
}
var entriesStore = store.memoryEntry();
var getEntriesFromFileSystem = memoize.async(createEntriesFromFileSystem, entriesStore);
function createEntriesFromFileSystem() {
    return recursivelyReadFolderFeatures(featuresFolderPath).then(function(features) {
        var entries = features.map(function(feature) {
            return createEntry(feature);
        });
        return readFeatureSourcesFromFolder(entries, featuresFolderPath, featureTranspiler).then(function() {
            return entries;
        });
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
function createEntry(feature) {
    return {
        feature: feature,
        toJSON: function() {
            var feature = this.feature;
            var solution = feature.solution;

            var object = {};
            var featureObject = {};
            var solutionObject = {};

            if (!solution || solution === 'none') {
                solutionObject.type = 'none';
                solutionObject.value = undefined;
            } else {
                solutionObject.type = solution.type;
                solutionObject.value = solution.value;
            }
            featureObject.name = feature.name;
            featureObject.solution = solutionObject;

            object.feature = featureObject;
            if (this.source) {
                object.source = this.source;
            }
            if (this.testOutput) {
                object.testOutput = this.testOutput;
            }
            if (this.fixOutput) {
                object.fixOutput = this.fixOutput;
            }
            if (this.mustBeTested) {
                object.mustBeTested = true;
            }
            if (this.mustBeFixed) {
                object.mustBeFixed = true;
            }
            if (this.hasOwnProperty('enabled')) {
                object.enabled = this.enabled;
            }

            return object;
        }
    };
}
function readFeatureSourcesFromFolder(entries, folderPath, transpiler) {
    var paths = entries.map(function(entry) {
        return folderPath + '/' + entry.feature.name + '/feature.js';
    });

    return getSources(paths).then(function(sources) {
        sources.forEach(function(source, index) {
            var entry = entries[index];
            entry.source = entry.feature.createRegisterCode(source);
        });
        return entries;
    });

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
}

module.exports = {
    getDistantInstruction: function(instruction, complete) {
        getNextInstruction(instruction).then(
            function(instruction) {
                // ensure nothing is shared for now
                if (instruction.name === 'fail' || instruction.name === 'complete') {
                    cleanDormant(instruction.detail.entries);
                }
                complete(
                    JSON.parse(JSON.stringify(instruction))
                );
            },
            function(value) {
                complete({
                    name: 'crash',
                    reason: 'unexpected-rejection',
                    detail: value
                });
            }
        );
    }
};

// var firstInstruction = {
//     name: 'start',
//     output: {
//         features: [
//             'const/scoped'
//         ]
//     }
// };
// getDistantInstruction(firstInstruction).then(function(instruction) {
//     console.log('instruction', instruction);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
