/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- fournir des méthode destinée à la "production" qui s'attendent à ce que les test/fix
existent ou alors hérite de la verison la plus proche ou alors sont considéré comme invalide
et qui récupère, selon le user-agent, un polyfill
il faudra aussi désactiver la validation e-tag en mode production parce que mieux vaut un vieux résultat
que pas de résultat

*/

require('../jsenv.js');
var path = require('path');
var Iterable = jsenv.Iterable;
// var Predicate = jsenv.Predicate;
var Agent = require('../agent/agent.js');
var fsAsync = require('../fs-async.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var rootFolder = path.resolve(__dirname, '../..').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var featuresFolderPath = rootFolder + '/src/features';
var polyfillFolder = cacheFolder + '/polyfill';
var createTranspiler = require('./transpiler.js');

var api = {};

api.getAllRecord = function() {
    return getEntries();
};
function getEntries() {
    return getEntriesFromFileSystem().then(function(entries) {
        jsenv.reviveFeatureEntries(entries);
        return entries;
    });
}
var entriesStore = store.memoryEntry();
function getEntriesFromFileSystem() {
    return memoize.async(createEntriesFromFileSystem, entriesStore)();
}
function createEntriesFromFileSystem() {
    return recursivelyReadFolderFeatures(featuresFolderPath).then(function(features) {
        var entries = features.map(function(feature) {
            return createEntry(feature);
        });
        return readFeatureSourcesFromFolder(
            entries,
            featuresFolderPath,
            createFeatureTranspiler()
        ).then(function() {
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

api.getAllRecordEnabledByNames = function(featureNames) {
    function filterEnabledEntryFromFeatureNames(entry) {
        return jsenv.Iterable.some(featureNames, function(name) {
            return entry.feature.match(name);
        });
    }

    return api.getAllRecord().then(function(entries) {
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
};

api.getAllRequiredTest = function(featureNames, agent) {
    return api.getAllRecordEnabledByNames(featureNames).then(function(entries) {
        var enabledEntries = entries.filter(entryIsEnabled);
        return updateAllRecordTestMark(enabledEntries, agent).then(function(meta) {
            return {
                entries: entries,
                meta: meta
            };
        });
    });
};
function entryIsEnabled(entry) {
    return entry.enabled;
}
function updateAllRecordTestMark(entries, agent) {
    return readAllOutputFromFileSystem(entries, agent, 'test').then(function() {
        var entriesWithoutTestOutput = entries.filter(entryTestIsMissing);
        if (entriesWithoutTestOutput.length) {
            entriesWithoutTestOutput.forEach(markEntryTestAsRequired);
            cleanDormant(entries, entriesWithoutTestOutput);
        }
    });
}
function readAllOutputFromFileSystem(entries, agent, type) {
    var createProperties;
    if (type === 'test') {
        createProperties = createTestOutputProperties;
    } else {
        createProperties = createFixOutputProperties;
    }

    var promises = entries.map(function(entry) {
        return readOutputFromFileSystem(
            entry.feature,
            agent,
            createProperties
        ).then(function(output) {
            var propertyName = type + 'Output';
            entry[propertyName] = output;
        });
    });
    return Promise.all(promises);
}
function createTestOutputProperties(feature) {
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
    return properties;
}
function createFixOutputProperties(feature) {
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
    var properties = {
        name: 'fix-output.json',
        encode: function(value) {
            return JSON.stringify(value, stringifyErrorReplacer, '\t');
        },
        cacheMode: 'default',
        sources: sources
    };
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
    var agentString = agent.toString();
    var featureFolderPath = featuresFolderPath + '/' + feature.name;
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;
    var properties = createProperties(feature, agent);
    properties.path = featureAgentCachePath + '/' + properties.name;
    return store.fileSystemEntry(properties);
}
function entryTestIsMissing(entry) {
    return entry.testOutput === undefined;
}
function markEntryTestAsRequired(entry) {
    entry.mustBeTested = true;
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

api.setAllTestRecord = function(records, agent) {
    return api.getAllRecord().then(function(entries) {
        return writeAllOutputToFileSystem(
            entries,
            agent,
            'test',
            records
        );
    });
};
function writeAllOutputToFileSystem(entries, agent, type, records) {
    var promises = records.map(function(record) {
        var featureName = record.featureName;
        var testOutput = record.output;
        var entry = entries.find(function(entry) {
            return entry.feature.match(featureName);
        });
        if (entry) {
            var createProperties;
            if (type === 'test') {
                createProperties = createTestOutputProperties;
            } else {
                createProperties = createFixOutputProperties;
            }

            return writeOutputToFileSystem(
                entry.feature,
                agent,
                createProperties,
                testOutput
            ).then(function() {
                return 200;
            });
        }
        return 404;
    });
    return Promise.all(promises);
}
function writeOutputToFileSystem(feature, agent, createProperties, output) {
    var cache = getFeatureAgentCache(feature, agent, createProperties);
    return cache.write(output);
}

api.getAllRequiredFix = function(featureNames, agent) {
    return api.getAllRecordEnabledByNames(featureNames).then(function(entries) {
        var enabledEntries = entries.filter(entryIsEnabled);
        return updateAllRecordFixMark(enabledEntries, agent).then(function(meta) {
            return {
                entries: entries,
                meta: meta
            };
        });
    });
};
var noSolution = {
    match: entryHasNoSolution
};
var inlineSolution = {
    match: entryUseInlineSolution
};
var polyfillSolution = {
    match: entryUsePolyfillSolution,

    solve: function(entriesUsingPolyfillSolution) {
        var entriesUsingCoreJS = entriesUsingPolyfillSolution.filter(entryUseCoreJSSolution);
        var entriesUsingFile = entriesUsingPolyfillSolution.filter(entryUseFileSolution);
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
    match: entryUseTranspileSolution,

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
function updateAllRecordFixMark(entries, agent) {
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
                return solution.match(entry);
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
}
function fail(reason) {
    return Promise.reject(reason);
}
function entryTestHasCrashed(entry) {
    return entry.testOutput.status === 'crashed';
}
function entryTestHasFailed(entry) {
    return entry.testOutput.detail.status === 'invalid';
}
function entryFixIsMissing(entry) {
    return entry.fixOutput === undefined;
}
function entryHasNoSolution(entry) {
    return entry.feature.solution.type === 'none';
}
function entryUseInlineSolution(entry) {
    return entry.feature.solution.type === 'inline';
}
function entryUseFileSolution(entry) {
    return entry.feature.solution.type === 'file';
}
function entryUseCoreJSSolution(entry) {
    return entry.feature.solution.type === 'corejs';
}
function entryUseBabelSolution(entry) {
    return entry.feature.solution.type === 'babel';
}
function entryUsePolyfillSolution(entry) {
    return (
        entryUseInlineSolution(entry) ||
        entryUseFileSolution(entry) ||
        entryUseCoreJSSolution(entry)
    );
}
function entryUseTranspileSolution(entry) {
    return entryUseBabelSolution(entry);
}
function markEntryFixAsRequired(entry) {
    entry.mustBeFixed = true;
}

api.setAllFixRecord = function(records, agent) {
    return api.getAllRecord().then(function(entries) {
        return writeAllOutputToFileSystem(entries, agent, 'fix', records);
    });
};

api.createClient = function createClient(mediator) {
    function testImplementation() {
        return mediator.send('getAllRequiredTest').then(function(data) {
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
                return mediator.send('setAllTestRecord', testRecords);
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
    function fixImplementation() {
        return mediator.send('getAllRequiredFix').then(function(data) {
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
                return mediator.send('setAllFixRecord', fixRecords);
            });
        });
    }
    function scanImplementation() {
        return testImplementation().then(function() {
            return fixImplementation();
        });
    }
    function entryHasTestMark(entry) {
        return entry.mustBeTested;
    }
    function entryHasFixMark(entry) {
        return entry.mustBeFixed;
    }

    return {
        test: testImplementation,
        fix: fixImplementation,
        scan: scanImplementation
    };
};

api.createOwnMediator = function(featureNames, agent) {
    agent = Agent.parse(agent);

    return {
        send: function(action, value) {
            if (action === 'getAllRequiredTest') {
                return api.getAllRequiredTest(
                    featureNames,
                    agent
                ).then(function(data) {
                    var clientData = {};
                    clientData.entries = getClientEntries(data.entries);
                    jsenv.assign(clientData, data.meta);
                    return clientData;
                });
            }
            if (action === 'setAllTestRecord') {
                return api.setAllTestRecord(value, agent);
            }
            if (action === 'getAllRequiredFix') {
                return api.getAllRequiredFix(featureNames, agent).then(function(data) {
                    var clientData = {};
                    clientData.entries = getClientEntries(data.entries);
                    jsenv.assign(clientData, data.meta);
                    return clientData;
                });
            }
            if (action === 'setAllFixRecord') {
                return api.setAllFixRecord(value, agent);
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
};

var ownMediator = api.createOwnMediator(
    ['const/scoped'],
    String(jsenv.agent)
);
api.client = api.createClient(ownMediator);

api.client.scan().catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

module.exports = api;
