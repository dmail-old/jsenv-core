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
        return feature.solution.type === 'none';
    }
};
var inlineSolution = {
    match: function(feature) {
        return feature.solution.type === 'inline';
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
        cacheMode: 'default',
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
var entryTestIsMissing = function(entry) {
    return entry.testOutput === undefined;
};
var entryTestHasCrashed = Predicate.every(entryIsEnabled, function(entry) {
    return entry.testOutput.status === 'crashed';
});
var entryTestHasFailed = Predicate.every(entryIsEnabled, function(entry) {
    return entry.testOutput.detail.status === 'invalid';
});
var entryFixIsMissing = function(entry) {
    return entry.fixOutput === undefined;
};
var entryHasTestMark = function(entry) {
    return entry.mustBeTested;
};
var entryHasFixMark = function(entry) {
    return entry.mustBeFixed;
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
function readOutputFromFileSystem(feature, agent, createEntryProperties) {
    var entry = getFeatureAgentEntry(feature, agent, createEntryProperties);
    return entry.read().then(function(data) {
        if (data.valid) {
            console.log('got valid data for', feature.name);
            return data.value;
        }
        console.log('no valid at', entry.path, 'because', data.reason);
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
function readAllOutputFromFileSystem(entries, agent, type) {
    var createEntryProperties;
    if (type === 'test') {
        createEntryProperties = getTestOutputEntryProperties;
    } else {
        createEntryProperties = getFixOutputEntryProperties;
    }

    var promises = entries.map(function(entry) {
        return readOutputFromFileSystem(
            entry.feature,
            agent,
            createEntryProperties
        ).then(function(output) {
            var propertyName = type + 'Output';
            entry[propertyName] = output;
        });
    });
    return Promise.all(promises);
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

    // ça me retourne les entries avec des marque mustbeTested
    // je n'ai plus qu'à run les tests si nécéssaire
    // sinon je passerais dans getAllRecordForFix
    getAllRequiredTest: function(featureNames, agent) {
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

    // retourne la liste de tous les record avec ceux dont ils manque le résulat du test marqué
    // avec mustBeTested
    updateAllRecordTestMark: function(entries, agent) {
        return readAllOutputFromFileSystem(entries, agent, 'test').then(function() {
            var entriesWithoutTestOutput = entries.filter(entryTestIsMissing);
            if (entriesWithoutTestOutput.length) {
                entriesWithoutTestOutput.forEach(markEntryTestAsRequired);
                cleanDormant(entries, entriesWithoutTestOutput);
            }
        });
    },

    setAllTestRecord: function(records, agent) {
        return api.getAllRecord().then(function(entries) {
            var promises = records.map(function(record) {
                var featureName = record.featureName;
                var testOutput = record.output;
                var entry = entries.find(function(entry) {
                    return entry.feature.match(featureName);
                });
                if (entry) {
                    return writeOutputToFileSystem(
                        entry.feature,
                        testOutput,
                        agent,
                        getTestOutputEntryProperties
                    ).then(function() {
                        return 200;
                    });
                }
                return 404;
            });
            return Promise.all(promises);
        });
    },

    getAllRequiredFix: function(featureNames, agent) {
        return api.getAllRecordEnabledByNames(featureNames).then(function(entries) {
            var enabledEntries = entries.filter(entryIsEnabled);
            return api.updateAllRecordFixMark(enabledEntries, agent).then(function(meta) {
                return {
                    entries: entries,
                    meta: meta
                };
            });
        });
    },

    updateAllRecordFixMark: function(entries, agent) {
        return readAllOutputFromFileSystem(
            entries,
            agent,
            'test'
        ).then(function() {
            var entriesWithoutTestOutput = entries.filter(entryTestIsMissing);
            if (entriesWithoutTestOutput.length) {
                return fail('some-test-are-missing', entries);
            }

            var entriesWithCrashedTest = entries.filter(entryTestHasCrashed);
            if (entriesWithCrashedTest.length) {
                return fail('some-test-have-crashed', entries);
            }

            var entriesWithFailedTest = entries.filter(entryTestHasFailed);
            var solutions = [polyfillSolution, transpileSolution, inlineSolution, noSolution];
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
            var entriesUsingInlineSolution = solutionsEntries[2];

            return readAllOutputFromFileSystem(
                entriesWithFailedTest,
                agent,
                'fix'
            ).then(function() {
                var polyfillWithoutFixOutput = entriesUsingPolyfillSolution.filter(entryFixIsMissing);
                var transpileWithoutFixOutput = entriesUsingTranspileSolution.filter(entryFixIsMissing);
                var inlineWithoutFixOutput = entriesUsingInlineSolution.filter(entryFixIsMissing);

                polyfillWithoutFixOutput.forEach(markEntryFixAsRequired);
                transpileWithoutFixOutput.forEach(markEntryFixAsRequired);
                inlineWithoutFixOutput.forEach(markEntryFixAsRequired);

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

                return Promise.all([
                    polyfillSolution.solve(polyfillWithoutFixOutput),
                    readFeatureSourcesFromFolder(
                        transpileWithoutFixOutput,
                        featuresFolderPath,
                        fixedFeatureTranspiler
                    )
                ]).then(function(data) {
                    return {
                        concatenedFixSource: data[0]
                    };
                });
            });
        });
    },

    setAllFixRecord: function(records, agent) {
        return api.getAllRecord().then(function(entries) {
            var promises = records.map(function(record) {
                var featureName = record.featureName;
                var fixOutput = record.output;
                var entry = entries.find(function(entry) {
                    return entry.feature.match(featureName);
                });
                if (entry) {
                    return writeOutputToFileSystem(
                        entry.feature,
                        fixOutput,
                        agent,
                        getFixOutputEntryProperties
                    ).then(function() {
                        return 200;
                    });
                }
                return 404;
            });
            return Promise.all(promises);
        });
    }
};

var mediator = {
    send: function(action, params) {
        if (action === 'getAllRequiredTest') {
            return api.getAllRequiredTest(params.features, params.agent).then(function(data) {
                var clientData = {};
                clientData.entries = getClientEntries(data.entries);
                jsenv.assign(clientData, data.meta);
                return clientData;
            });
        }
        if (action === 'setAllTestRecord') {
            return api.setAllTestRecord(params.records, params.agent);
        }
        if (action === 'getAllRequiredFix') {
            return api.getAllRequiredFix(params.features, params.agent).then(function(data) {
                var clientData = {};
                clientData.entries = getClientEntries(data.entries);
                jsenv.assign(clientData, data.meta);
                return clientData;
            });
        }
        if (action === 'setAllFixRecord') {
            return api.setAllFixRecord(params.records, params.agent);
        }
    }
};
function getClientEntries(serverEntries) {
    var JSONSource = JSON.stringify(serverEntries);
    var clientEntries = JSON.parse(JSONSource);
    try {
        jsenv.reviveFeatureEntries(clientEntries);
    } catch (e) {
        return fail('some-feature-source', e);
    }
    return clientEntries;
}

var featureNames = ['const/scoped'];
var agentString = String(jsenv.agent);

function testImplementation(params) {
    return mediator.send('getAllRequiredTest', params).then(function(data) {
        var entries = data.entries;
        var entriesToTest = entries.filter(entryHasTestMark);
        var featuresToTest = entriesToTest.map(function(entry) {
            return entry.feature;
        });
        var testRecords = createRecords();

        return testFeatures(
            featuresToTest,
            testRecords
        ).then(function() {
            return mediator.send('setAllTestRecord', {
                records: testRecords,
                agent: params.agent
            });
        });
    });
}
function createRecords() {
    var records = [];
    return records;
}
function testFeatures(features, records) {
    return new Promise(function(resolve, reject) {
        jsenv.testFeatures(
            features,
            {
                progress: function(event) {
                    console.log('tested', event.target.name, '->', event.detail);
                    records.push({
                        featureName: event.target.name,
                        output: {
                            status: 'completed',
                            reason: 'test-result',
                            detail: event.detail
                        }
                    });
                },
                complete: function() {
                    resolve();
                },
                crash: function(e) {
                    reject(e);
                }
            }
        );
    });
}
function fixImplementation(params) {
    return mediator.send('getAllRequiredFix', params).then(function(data) {
        var entries = data.entries;
        var fixRecords = createRecords();
        var concatenedFixSource = data.concatenedFixSource;
        var entriesToFix = entries.filter(entryHasFixMark);
        var featuresToFix = entriesToFix.map(function(entry) {
            return entry.feature;
        });
        var featuresUsingInlineSolution = featuresToFix.filter(function(feature) {
            return feature.solution.type === 'inline';
        });
        var featureUsingConcatenedSolution = featuresToFix.filter(function(feature) {
            return (
                feature.solution.type === 'corejs' ||
                feature.solution.type === 'file'
            );
        });

        featuresUsingInlineSolution.forEach(function(feature) {
            try {
                var unreachableValue = feature.compile();
                unreachableValue.polyfill(feature.solution);
            } catch (e) {
                fixRecords.push({
                    featureName: feature.name,
                    output: {
                        status: 'crashed',
                        reason: 'throw',
                        detail: e
                    }
                });
            }
        });
        if (concatenedFixSource) {
            try {
                eval(concatenedFixSource); // eslint-disable-line no-eval
            } catch (e) {
                // on fait crash toutes les features marqué comme fix
                // et ayantpour solution corejs ou file
                featureUsingConcatenedSolution.forEach(function(feature) {
                    fixRecords.push({
                        featureName: feature.name,
                        output: {
                            status: 'crashed',
                            reason: 'some-feature-source',
                            detail: e
                        }
                    });
                });
            }
        }

        // test feature which have no output yet (not crashed)
        var featuresToTest = featuresToFix.filter(function(feature) {
            var output = Iterable.find(fixRecords, function(record) {
                return feature.match(record.featureName);
            });
            return !output;
        });
        return testFeatures(featuresToTest, fixRecords).then(function() {
            return mediator.send('setAllFixRecord', {
                records: fixRecords,
                agent: params.agent
            });
        });
    });
}

/*
// scanImplementation sera la combo de test + fix
function scanImplementation() {

}
*/

// testImplementation({
//     features: featureNames,
//     agent: agentString
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

fixImplementation({
    features: featureNames,
    agent: agentString
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

api.testImplementation = testImplementation;
api.fixImplementation = fixImplementation;
module.exports = api;
