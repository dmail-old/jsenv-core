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
            feature.solution.type === 'file' ||
            feature.solution.type === 'inline'
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
// var entryFeatureMatching = function(entry, otherEntry) {
//     return entry.feature.match(otherEntry.feature.name);
// };
var entryTestIsMissing = function(entry) {
    return entry.testOutput === undefined;
};
var entryTestHasCrashed = Predicate.every(entryIsEnabled, function(entry) {
    return entry.testOutput.status === 'crashed';
});
var entryTestHasFailed = Predicate.every(entryIsEnabled, function(entry) {
    return entry.testOutput.detail.status === 'invalid';
});
var entryFixIsMissing = Predicate.every(entryTestHasFailed, function(entry) {
    return entry.fixOutput === undefined;
});
// var entryFixHasCrashed = Predicate.every(entryTestHasFailed, function(entry) {
//     return entry.fixOutput.status === 'crashed';
// });
// var entryFixHasFailed = Predicate.every(entryTestHasFailed, function(entry) {
//     return entry.fixOutput.detail.status === 'invalid';
// });
var entryHasTestMark = function(entry) {
    return entry.mustBeTested;
};
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
        var entry = getFeatureAgentEntry(feature, agent, createEntryProperties);
        return entry.read().then(function(data) {
            if (data.valid) {
                console.log('got valid data for', feature.name);
                return data.value;
            }
            console.log('no valid data for', feature.name, 'because', data.reason);
            return undefined;
        });
    }
    function writeOutputToFileSystem(feature, output, agent, createEntryProperties) {
        var entry = getFeatureAgentEntry(feature, agent, createEntryProperties);
        return entry.write(output);
    }
    function getFeatureAgentEntry(feature, agent, createEntryProperties) {
        var agentString = agent.toString();
        var featureCacheFolderPath = featuresFolderPath + '/' + feature.name + '/.cache';
        var featureAgentCachePath = featureCacheFolderPath + '/' + agentString;
        var entryProperties = createEntryProperties(feature, agent);
        entryProperties.path = featureAgentCachePath + '/' + entryProperties.name;
        return store.fileSystemEntry(entryProperties);
    }
}
function getEntries() {
    return getEntriesFromFileSystem().then(function(entries) {
        jsenv.reviveFeatureEntries(entries);
        return entries;
    });
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

            var object = {};
            var featureObject = {};

            featureObject.name = feature.name;

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
            if (this.enabled) {
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
function fail(reason) {
    return Promise.reject(reason);
}

var api = {
    // retourne la liste de tous les records
    getAllRecord: function() {
        return getEntries();
    },

    // retourne la liste de tous les record enabled si ils font partie de featureNames
    getAllRecordEnabledByNames: function(featureNames) {
        function filterEnabledEntryFromFeatureNames(entry) {
            return jsenv.Iterable.some(featureNames, function(name) {
                return entry.feature.match(name);
            });
        }

        return this.getAllRecord().then(function(entries) {
            var half = Iterable.bisect(entries, filterEnabledEntryFromFeatureNames);
            var toEnable = half[0];
            // var toDisable = half[1];

            // toDisable.forEach(function(entry) {
            //     entry.feature.disable();
            // });
            toEnable.forEach(function(entry) {
                entry.feature.enable();
            });

            entries.forEach(function(entry) {
                if (entry.feature.isEnabled()) {
                    entry.enabled = true;
                }
            });
            return entries;
        });
    },

    // retourne la liste de tous les record avec ceux dont ils manque le résulat du test marqué
    // avec mustBeTested
    updateAllRecordTestMark: function(entries, agent) {
        return harmonizeEntriesWithFileSystem(
            entries,
            'testOutput',
            {
                agent: agent,
                createEntryProperties: getTestOutputEntryProperties
            }
        ).then(function() {
            var entriesWithoutTestOutput = entries.filter(entryTestIsMissing);
            if (entriesWithoutTestOutput.length) {
                entriesWithoutTestOutput.forEach(markEntryTestAsRequired);
                cleanDormant(entries, entriesWithoutTestOutput);
            }
        });
    },

    // ça me retourne les entries avec des marque mustbeTested
    // je n'ai plus qu'à run les tests si nécéssaire
    // sinon je passerais dans getAllRecordForFix
    getAllRecordForTest: function(featureNames, agent) {
        return api.getAllRecordEnabledByNames(featureNames).then(function(entries) {
            var enabledEntries = entries.filter(entryIsEnabled);
            return api.updateAllRecordTestMark(enabledEntries, agent).then(function(meta) {
                return {
                    entries: entries,
                    meta: meta
                };
            });
        });
    },

    setAllRecordTest: function(entries, agent) {
        var entriesWithTestMark = entries.filter(entryHasTestMark);
        return harmonizeEntriesWithFileSystem(
            entriesWithTestMark,
            'testOutput',
            {
                agent: agent,
                createEntryProperties: getTestOutputEntryProperties
            }
        );
    },

    updateAllRecordFixMark: function(entries, agent) {
        var entriesWithCrashedTest = entries.filter(entryTestHasCrashed);
        if (entriesWithCrashedTest.length) {
            return fail('some-test-have-crashed', entries);
        }

        var entriesWithFailedTest = entries.filter(entryTestHasFailed);

        var solutions = [polyfillSolution, transpileSolution, noSolution];
        var remainingEntriesWithFailedTest = entriesWithFailedTest;
        var solutionsEntries = solutions.map(function(solution) {
            var half = Iterable.bisect(remainingEntriesWithFailedTest, function(entry) {
                return solution.match(entry.feature);
            });
            remainingEntriesWithFailedTest = half[1];
            return half[0];
        });

        var entriesUsingPolyfillSolution = solutionsEntries[0];
        var entriesUsingTranspileSolution = solutionsEntries[1];
        // on ignore ces deux cas ici
        // var entriesWithoutSolution = solutionsEntries[2];
        // var entriesUsingUnknownSolution = remainingEntriesWithFailedTest;
        entriesUsingPolyfillSolution.forEach(markEntryFixAsRequired);
        entriesUsingTranspileSolution.forEach(markEntryFixAsRequired);

        var harmonizeFixPromise = harmonizeEntriesWithFileSystem(
            entriesWithFailedTest,
            'fixOutput',
            {
                agent: agent,
                createEntryProperties: getFixOutputEntryProperties
            }
        );

        return Promise.all([
            polyfillSolution.solve(entriesUsingPolyfillSolution),
            harmonizeFixPromise
        ]).then(function(data) {
            var fixSource = data[0];
            var entriesWithoutFix = entriesWithFailedTest.filter(entryFixIsMissing);

            if (entriesWithoutFix.length) {
                entriesWithoutFix.forEach(markEntryTestAsRequired);
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
                        fixSource: fixSource
                    };
                });
            }
        });
    },

    getAllRecordFoxFix: function(entries, agent) {
        var enabledEntries = entries.filter(entryIsEnabled);
        return this.updateAllRecordFixMark(enabledEntries, agent).then(function(meta) {
            return {
                entries: entries,
                meta: meta
            };
        });
    },

    setAllRecordFix: function(entries, agent) {
        var entriesWithFixMark = entries.filter(function(entry) {
            return entry.mustBeFixed;
        });
        return harmonizeEntriesWithFileSystem(
            entriesWithFixMark,
            'fixOutput',
            {
                agent: agent,
                createEntryProperties: getFixOutputEntryProperties
            }
        );
    }
    // getDistantInstruction: function(instruction, complete) {
    //     getNextInstruction(instruction).then(
    //         function(instruction) {
    //             // ensure nothing is shared for now
    //             if (instruction.name === 'fail' || instruction.name === 'complete') {
    //                 cleanDormant(instruction.detail.entries);
    //             }
    //             complete(
    //                 JSON.parse(JSON.stringify(instruction))
    //             );
    //         },
    //         function(value) {
    //             complete({
    //                 name: 'crash',
    //                 reason: 'unexpected-rejection',
    //                 detail: value
    //             });
    //         }
    //     );
    // }
};

api.getAllRecordForTest(['const/scoped'], String(jsenv.agent)).then(function(data) {
    var clientEntries = JSON.parse(JSON.stringify(data.entries));
    try {
        jsenv.reviveFeatureEntries(clientEntries);
    } catch (e) {
        return fail('some-feature-source', e);
    }

    var entriesToTest = clientEntries.filter(entryHasTestMark);
    var featuresToTest = entriesToTest.map(function(entry) {
        return entry.feature;
    });
    var storeFeatureOutput = function(feature, outputName, output) {
        var entry = entriesToTest.find(function(entry) {
            return feature.match(entry.feature.name);
        });
        entry[outputName] = output;
    };
    jsenv.testFeatures(
        featuresToTest,
        {
            progress: function(event) {
                console.log('tested', event.target.name, '->', event.detail);
                storeFeatureOutput(event.target, 'testOutput', {
                    status: 'completed',
                    reason: 'test-result',
                    detail: event.detail
                });
            },
            complete: function() {

            },
            crash: function(e) {
                setTimeout(function() {
                    throw e;
                });
            }
        }
    );
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

module.exports = api;

// getDistantInstruction(firstInstruction).then(function(instruction) {
//     console.log('instruction', instruction);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
