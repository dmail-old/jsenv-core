/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- il faut que getRequiredFix utilise le même load qui
se résoud à {type: 'excluded'} que polyfill

et dailleurs dans polyfill il manque masse truc comme par exemple
les fait de load les fichiers ou bien de build core js
en gros getAllRequiredFix et polyfill() se ressemble énormément

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

var Iterable = jsenv.Iterable;
var Thenable = jsenv.Thenable;

var getFeaturesFolder = require('./get-features-folder.js');
var getFeaturePath = function getFeaturePath(featureName) {
    return getFeaturesFolder() + '/' + featureName;
};
var listFeatureNames = require('./list-feature-names.js');
var build = require('./build.js');
var transpiler = require('./transpiler.js');
var api = {};

// api.listFeatureNames().then(function(names) {
//     console.log('names', names);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

api.getAllRequiredTest = function(featureNames, agent) {
    return readAllRecordFromFileSystem(
        featureNames,
        agent,
        'test'
    ).then(function(records) {
        var featureNamesToTest = Iterable.filterBy(featureNames, records, recordIsInvalid);
        // console.log('to test', featureNamesToTest);
        return api.build(featureNamesToTest, {
            transpiler: transpiler,
            mode: 'test'
        });
    }).then(function(build) {
        return build.source;
    });
};
function recordIsInvalid(record) {
    return record.data.valid === false;
}
function readAllRecordFromFileSystem(featureNames, agent, type) {
    return Promise.all(featureNames.map(function(featureName) {
        return readRecordFromFileSystem(featureName, agent, type);
    }));
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
function stringify(value) {
    try {
        return JSON.stringify(value, stringifyErrorReplacer, '\t');
    } catch (e) {
        return '[Circular]';
    }
}
function createTestOutputProperties(featureName, agent) {
    var agentString = agent.toString();
    var featureFolderPath = getFeaturesFolder() + '/' + featureName;
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        name: 'test-output.json',
        encode: stringify,
        sources: [
            {
                path: getFeaturePath(featureName) + '/test.js',
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
    var featureFolderPath = getFeaturePath(featureName);
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
function readOutputFromFileSystem(featureName, agent, createProperties) {
    var cache = getFeatureAgentCache(featureName, agent, createProperties);
    return cache.read();
}
function getFeatureAgentCache(featureName, agent, createProperties) {
    var properties = createProperties(featureName, agent);
    return store.fileSystemEntry(properties);
}
// api.getAllRequiredTest(
//     ['object'],
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

api.getAllRequiredFix = function(featureNames, agent) {
    return readAllRecordFromFileSystem(
        featureNames,
        agent,
        'test'
    ).then(function(testRecords) {
        var invalidFeatureNames = Iterable.filterBy(featureNames, testRecords, recordIsInvalid);
        if (invalidFeatureNames.length) {
            throw new Error('some test are invalid: ' + invalidFeatureNames);
        }
        // var crashedFeatureNames = Iterable.filterBy(featureNames, testRecords, recordIsCrashed);
        // if (crashedFeatureNames.length) {
        //     throw new Error('some test have crashed: ' + crashedFeatureNames);
        // }
        var failedTestFeatureNames = Iterable.filterBy(featureNames, testRecords, recordIsFailed);
        return failedTestFeatureNames;
    }).then(function(featureNamesToFix) {
        console.log('to fix', featureNamesToFix);
        return Thenable.all([
            readAllRecordFromFileSystem(
                featureNamesToFix,
                agent,
                'fix'
            ),
            build(featureNamesToFix, {
                transpiler: transpiler,
                mode: 'fix'
                // en gros ici, si la dépendance a un test déjà satisfait
                // alors résoud à {type: 'excluded'}
            }).then(function(build) {
                return build.compile();
            })
        ]).then(function(data) {
            var fixRecords = data[0];
            var generated = data[1];
            var features = generated.features;
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

            function retainInvalid(features) {
                return Iterable.filterBy(features, fixRecords, recordIsInvalid);
            }
            function getUniqSolutions(features/* , excludeDependencies */) {
                var solutions = features.map(function(feature) {
                    return feature.solution;
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

            var featuresUsingInlineSolution = featuresGroup.inline;
            var inlineWithInvalidFix = retainInvalid(featuresUsingInlineSolution);
            var inlineSolutions = getUniqSolutions(inlineWithInvalidFix);
            var inlineSolver = inlineSolution.solve(inlineSolutions);
            console.log('inline fix', inlineSolutions.length);

            var featuresUsingFileSolution = featuresGroup.file;
            var fileWithInvalidFix = retainInvalid(featuresUsingFileSolution);
            var fileSolutions = getUniqSolutions(fileWithInvalidFix);
            var fileSolver = fileSolution.solve(fileSolutions);
            console.log('file fix', fileSolutions.length);

            var featuresUsingCoreJSSolution = featuresGroup.corejs;
            var corejsWithInvalidFix = retainInvalid(featuresUsingCoreJSSolution);
            var coreJSSolutions = getUniqSolutions(corejsWithInvalidFix);
            var coreJSSolver = coreJSSolution.solve(coreJSSolutions);
            console.log('corejs fix', coreJSSolutions.length);

            var featuresUsingBabelSolution = featuresGroup.babel;
            var babelWithInvalidFix = retainInvalid(featuresUsingBabelSolution);
            var babelSolutions = getUniqSolutions(babelWithInvalidFix);
            var babelSolver = Thenable.resolve(
                babelSolution.solve(babelSolutions)
            ).then(function(transpiler) {
                /*
                it may be the most complex thing involved here so let me explain
                we create a transpiler adapted to required features
                then we create a babel plugin which transpile template literals using that transpiler
                finally we create a transpiler which uses that plugin
                */
                var plugin = createTranspiler.transpileTemplateTaggedWith(function(code) {
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
                var fixedFeatureTranspiler = transpiler.clone();
                fixedFeatureTranspiler.options.plugins.push(plugin);
                return fixedFeatureTranspiler;
            });

            return Thenable.all([
                inlineSolver,
                fileSolver,
                coreJSSolver,
                babelSolver
            ]).then(function(data) {
                var fileFunctions = data[1];
                console.log('fileFunctions', fileFunctions);
                var namedFileFunctions = {};
                fileSolutions.forEach(function(solution, index) {
                    namedFileFunctions[solution.value] = fileFunctions[index];
                });

                var fixedFeatureTranspiler = data[3];
                var featureNamesToFix = [].concat(
                    inlineWithInvalidFix,
                    fileWithInvalidFix,
                    corejsWithInvalidFix,
                    babelWithInvalidFix
                ).map(function(feature) {
                    return jsenv.parentPath(feature.filename);
                });

                // console.log('feature names to fix', featureNamesToFix);
                return build(
                    featureNamesToFix,
                    {
                        transpiler: fixedFeatureTranspiler,
                        mode: 'fix',
                        meta: {
                            namedFileFunctions: namedFileFunctions
                        }
                    }
                ).then(function(bundle) {
                    return bundle.source;
                    // renvoyer aussi au client le codeJSSolver
                    // var coreJSSolver = data[1];
                });
            });
        });
    });
};
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
// api.getAllRequiredFix(
//     ['object'],
//     jsenv.agent
// ).then(function(data) {
//     console.log('required fix data', data);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

api.setAllFixRecord = function(records, agent) {
    return writeAllRecordToFileSystem(
        records,
        agent,
        'fix'
    );
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
// api.client.scan().then(function() {
//     console.log(Object.assign);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function getClosestAgentForFeature(agent, featureName) {
    var featureFolderPath = getFeaturePath(featureName);
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

function getInstruction(featureName, agent) {
    return getClosestAgentForFeature(agent, featureName).then(
        function(featureAgent) {
            return readRecordFromFileSystem(
                featureName,
                featureAgent,
                'test'
            ).then(function(testRecord) {
                if (recordIsInvalid(testRecord)) {
                    return {
                        name: 'fix',
                        reason: 'test-missing'
                    };
                }
                if (recordIsFailed(testRecord)) {
                    return readRecordFromFileSystem(
                        featureName,
                        featureAgent,
                        'fix'
                    ).then(function(fixRecord) {
                        if (recordIsInvalid(fixRecord)) {
                            return {
                                name: 'fix',
                                reason: 'test-failed-and-fix-missing'
                            };
                        }
                        if (recordIsFailed(fixRecord)) {
                            return {
                                name: 'fail',
                                reason: 'test-failed-and-fix-failed'
                            };
                        }
                        return {
                            name: 'fix',
                            reason: 'test-failed'
                        };
                    });
                }
                return {
                    name: 'noop',
                    reason: 'test-passed'
                };
            });
        },
        function(e) {
            if (e) {
                if (e.code === 'NO_AGENT') {
                    return {
                        name: 'fix',
                        reason: 'test-missing',
                        detail: e
                    };
                }
                if (e.code === 'NO_AGENT_VERSION') {
                    return {
                        name: 'fix',
                        reason: 'test-missing',
                        detail: e
                    };
                }
            }
            return Promise.reject(e);
        }
    );
}

api.polyfill = function(agent, featureNames) {
    return Promise.all(featureNames.map(function(featureName) {
        return getInstruction(featureName, agent);
    })).then(function(instructions) {
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
            load: function(id) {
                console.log('load', id);
                // on pourrais aussi déplacer ça dans resolveId
                // et rediriger #weak vers un fichier spécial qui contient grosso modo
                // export default {weak: true};
                var fixMark = '/fix.js';
                var fixLength = fixMark.length;
                var isFix = id.slice(-fixLength) === fixMark;
                console.log('isfix', isFix);
                if (isFix) {
                    var featureName = path.dirname(path.relative(getFeaturesFolder(), id));
                    var featureNameIndex = featureNames.indexOf(featureName);
                    var instructionPromise;
                    if (featureNameIndex === -1) {
                        instructionPromise = getInstruction(featureName, agent);
                    } else {
                        instructionPromise = Promise.resolve(instructions[featureNameIndex]);
                    }
                    return instructionPromise.then(function(instruction) {
                        if (instruction.name === 'fail') {
                            throw new Error('unfixable dependency ' + featureName);
                        }
                        if (instruction.name === 'fix') {
                            return undefined;
                        }
                        return 'export default {type: \'excluded\'};';
                    });
                }
                console.log('ici', id);
            },
            footer: 'jsenv.polyfill(__exports__);'
        }).then(function(bundle) {
            return bundle.source;
        });
    });
};
api.polyfill(
    jsenv.agent,
    ['object/assign']
).then(function(polyfill) {
    console.log('polyfill', polyfill);
    eval(polyfill);
    console.log(Object.assign);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

api.transpile = function(path, featureNames, agent) {
    return Promise.all(featureNames.map(function(featureName) {
        return getInstruction(featureName, agent);
    })).then(function(instructions) {
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
            mode: 'transpile'
        }).then(function(bundle) {
            return bundle.compile();
        }).then(function(features) {
            return getFeaturesUsingSolution(features, babelSolution);
        }).then(function() {

        });
    });
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

api.getFeaturesFolder = getFeaturesFolder;
api.getFeaturePath = getFeaturePath;
api.listFeatureNames = listFeatureNames;
api.build = build;
api.transpiler = transpiler;
api.getClosestAgent = getClosestAgentForFeature;
api.getInstruction = getInstruction;

module.exports = api;
