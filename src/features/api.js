/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- le cas ou il n'y a pas de feature.js dans le dossier que fait-on?
- getFixSource qui doit retourner ce dont on a besoin pour fix en prod

utiliser ça pour générer les bundle de features
https://github.com/rollup/rollup/wiki/JavaScript-API

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
// var uneval = require('../uneval.js');
var rootFolder = path.resolve(__dirname, '../..').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var featuresFolderPath = rootFolder + '/src/features';
var corejsCacheFolder = cacheFolder + '/corejs';
var createTranspiler = require('./transpiler.js');
var bundle = require('../builder/builder.js');

var featureTranspiler = createTranspiler({
    cache: true,
    cacheMode: 'default',
    filename: false,
    sourceMaps: false,
    plugins: [
        'transform-es3-property-literals',
        'transform-es3-member-expression-literals',
        'transform-es2015-shorthand-properties',
        'transform-es2015-block-scoping',
        'transform-es2015-arrow-functions',
        [
            'transform-es2015-template-literals',
            {
                loose: true // because we may not have Object.freeze
            }
        ],
        [
            'transform-es2015-spread',
            {
                loose: true // because we may not have Symbol.iterator etc
            }
        ],
        'transform-es2015-destructuring'
    ]
});
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

api.getAllFeature = function(featureNames) {
    return buildFeatures(
        featureNames,
        featureTranspiler
    ).then(function(build) {
        return build.compile();
    });
};
function buildFeatures(featureNames, transpiler) {
    var featureImports = createFeatureImports(featureNames);

    return bundle(featureImports, {
        root: featuresFolderPath,
        transpiler: transpiler
    }).then(function(source) {
        return {
            source: source,
            compile: function() {
                var collecteds = eval(source);
                return collecteds.map(function(collected) {
                    return collected.default;
                }).map(function(feature, index) {
                    feature.name = featureNames[index];
                    return feature;
                });
            }
        };
    });
}
function createFeatureImports(featureNames, mode) {
    mode = mode || 'default';

    var featureImports = featureNames.map(function(feature) {
        var importDescription = {
            import: mode === 'default' ? 'default' : 'fix',
            from: './' + feature + '/feature.js'
        };
        return importDescription;
    });

    return featureImports;
}
// api.getAllFeature([
//     'string/prototype/symbol-iterator'
// ]).then(function(features) {
//     console.log('got features', features);
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
        var invalidRecords = records.filter(recordIsInvalid);
        var featureNamesToTest = invalidRecords.map(getRecordFeatureName);
        return buildFeatures(featureNamesToTest, featureTranspiler);
    }).then(function(build) {
        return build.source;
    });
};
function recordIsInvalid(record) {
    return record.data.valid === false;
}
function getRecordFeatureName(record) {
    return record.feature;
}
function readAllRecordFromFileSystem(featureNames, agent, type) {
    var createProperties;
    if (type === 'test') {
        createProperties = createTestOutputProperties;
    } else {
        createProperties = createFixOutputProperties;
    }

    var outputsPromises = featureNames.map(function(featureName) {
        return readOutputFromFileSystem(
            featureName,
            agent,
            createProperties
        );
    });
    return Thenable.all(outputsPromises).then(function(outputs) {
        var records = outputs.map(function(data, index) {
            var featureName = featureNames[index];
            if (data.valid) {
                console.log('got valid data for', featureName);
            }
            console.log('no valid for', featureName, 'because', data.reason);

            return {
                feature: featureName,
                data: data
            };
        });
        return records;
    });
}
function createTestOutputProperties(featureName, agent) {
    var agentString = agent.toString();
    var featureFolderPath = featuresFolderPath + '/' + featureName;
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        name: 'test-output.json',
        encode: function(value) {
            return JSON.stringify(value, stringifyErrorReplacer, '\t');
        },
        sources: [
            {
                path: featuresFolderPath + '/' + featureName + '/feature.js',
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
    var featureFolderPath = featuresFolderPath + '/' + featureName;
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var featureFilePath = featureFolderPath + '/feature.js';
    var sources = [
        {
            path: featureFilePath,
            strategy: 'eTag'
        }
    ];
    var properties = {
        name: 'fix-output.json',
        encode: function(value) {
            return JSON.stringify(value, stringifyErrorReplacer, '\t');
        },
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
// api.getAllRequiredTest(['let'], jsenv.agent).then(function(data) {
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
            record.feature,
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
        var invalidTestRecords = testRecords.filter(recordIsInvalid);
        if (invalidTestRecords.length) {
            throw new Error('some test are invalid: ' + invalidTestRecords.map(getRecordFeatureName));
        }
        var crashedTestRecords = testRecords.filter(testRecordIsCrashed);
        if (crashedTestRecords.length) {
            throw new Error('some test have crashed: ' + crashedTestRecords.map(getRecordFeatureName));
        }
        var failedTestRecords = testRecords.filter(testRecordIsFailed);
        return failedTestRecords;
    }).then(function(failedTestRecords) {
        var featureNamesToFix = failedTestRecords.map(getRecordFeatureName);

        return Thenable.all([
            readAllRecordFromFileSystem(
                featureNamesToFix,
                agent,
                'fix'
            ),
            api.getAllFeatures(featureNamesToFix)
        ]).then(function(data) {
            var fixRecords = data[0];
            var features = data[1];
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
                corejs: getFeaturesUsingSolution(coreJSSolution),
                babel: getFeaturesUsingSolution(babelSolution),
                none: getFeaturesUsingSolution(noSolution)
            };

            function retainInvalid(features) {
                return features.filter(function(feature, index) {
                    return recordIsInvalid(fixRecords[index]);
                });
            }
            function getUniqSolutions(features) {
                return Iterable.uniq(
                    features.map(function(feature) {
                        return feature.solution;
                    })
                );
            }

            var featuresUsingInlineSolution = featuresGroup.inline;
            var inlineWithInvalidFix = retainInvalid(featuresUsingInlineSolution);
            var inlineSolutions = getUniqSolutions(inlineWithInvalidFix);
            var inlineSolver = inlineSolution.solve(inlineSolutions);
            console.log('inline fix', inlineSolutions.length);

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
                return fixedFeatureTranspiler;
            });

            return Thenable.all([
                inlineSolver,
                coreJSSolver,
                babelSolver
            ]).then(function(data) {
                var fixedFeatureTranspiler = data[2];
                var featureNamesToFix = [].concat(
                    inlineWithInvalidFix,
                    corejsWithInvalidFix,
                    babelWithInvalidFix
                ).map(function(feature) {
                    return feature.name;
                });
                return buildFeatures(featureNamesToFix, fixedFeatureTranspiler).then(function(build) {
                    return build.source;
                    // renvoyer aussi au client le codeJSSolver
                    // à réfléchir car je ne sais pas comment je vais faire ça
                    // var coreJSSolver = data[1];
                });
            });
        });
    });
};
function testRecordIsCrashed(record) {
    return record.data.value.status === 'crashed';
}
function testRecordIsFailed(record) {
    return record.data.value.status === 'invalid';
}
var noSolution = {
    match: featureHasNoSolution
};
var inlineSolution = {
    match: featureUseInlineSolution,

    solve: function() {

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
function featureUseCoreJSSolution(feature) {
    return feature.solution.type === 'corejs';
}
function featureUseBabelSolution(feature) {
    return feature.solution.type === 'babel';
}
// api.getAllRequiredFix(
//     ['const/scoped'],
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
        'promise/unhandled-rejection',
        'promise/rejection-handled'
    ],
    String(jsenv.agent)
);
api.client = jsenv.createImplementationClient(ownMediator);
// api.client.scan().then(function() {
//     console.log('here');
//     // console.log(Math.DEG_PER_RAD);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

api.getClosestAgentForFeature = function(agent, featureName) {
    var featureFolderPath = featuresFolderPath + '/' + featureName;
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
    function missingAgent() {
        var missing = {
            code: 'missing-agent',
            featureName: featureName,
            agentName: agent.name
        };
        return missing;
    }
    function missingVersion() {
        var missing = {
            code: 'missing-version',
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
            return missingAgent();
        }
        return Promise.reject(e);
    }).then(function() {
        return adaptVersion(
            closestAgent.version,
            featureCachePath + '/' + closestAgent.name
        ).catch(function(e) {
            if (e && e.code === 'ENOENT') {
                return missingVersion();
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
        return Thenable.all(promises).then(function(/* featureAgents */) {
            // en se basant sur le pseud-code ci dessous
            // on peut comprendre ce que le client doit faire selon le cas dans lequel on se trouve

            /*
            if (testIsMissing || testIsCrashed) {
                if (featureHasSolution) {
                    return {
                        instruction: 'fix',
                        reason: 'test-missing-or-crashed',
                        detail: getFeatureSolution()
                    };
                }
                return {
                    instruction: 'do-nothing',
                    reason: 'test-missing-or-crashed-and-no-solution'
                };
            } else if (testIsFailed) {
                if (featureHasSolution) {
                    var featureFix = getFeatureFix();
                    if (featureFixIsMissing || featureFixIsCrashed) {
                        return {
                            instruction: 'fix',
                            reason: 'test-invalid-and-fix-missing-or-crashed',
                            detail: getFeatureSolution()
                        };
                    }
                    if (featureFixIsFailed) {
                        return {
                            instruction: 'fail',
                            reason: 'test-invalid-and-fix-invalid'
                        };
                    }
                    return {
                        instruction: 'fix',
                        reason: 'test-invalid'
                    };
                }
                return {
                    instruction: 'fail',
                    reason: 'test-invalid-and-no-solution'
                };
            }
            */
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

module.exports = api;

// function splitFeatureName(featureName) {
//     var parts = featureName.split('/');
//     var names = parts.map(function(name, index) {
//         return parts.slice(0, index + 1).join('/');
//     });
//     return names;
// }

// function collectAllDependencies(features) {
//     var dependencies = [];
//     function visit(feature) {
//         feature.dependencies.forEach(function(dependency) {
//             if (Iterable.includes(features, dependency)) {
//                 return;
//             }
//             if (Iterable.includes(dependencies, dependency)) {
//                 return;
//             }
//             dependencies.push(dependency);
//             visit(dependency);
//         });
//     }
//     features.forEach(visit);
//     return dependencies;
// }
