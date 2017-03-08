/*

this is all about mapping
https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
with
https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js

- systemjs
une fois que systemjs marche on se met en mode ok magel
on est censé être capable de transpiler dynamiquement et donc de redémarrer le serveur qu'on avait avant

var oldResolve = System[System.constructor.resolve];
System[System.constructor.resolve] = function(key, parent) {
    // c'est ici qu'on fera api.transpile pour récup le chemin vers le fichier
    // dans nodejs
    // et qu'on fera un appel http pour le browser
    // euh nan pour le browser y'aura juste rien à faire puisqu'on
    // laisse la requête http partir vers le serveur et on y répondra
};

- une fois que ce serveur tourne on met en place
un truc genre compatibility-client.html qui essayera de communiquer avec ledit serveur
afin de pouvoir tester firefox/chrome etc

- a priori si on a un résultat de test positif pour array/from pour node0.12 on ne relance pas le test si
la version actuelle de node est ulétieure
le corollaire est que lorsqu'on écrit un test dans le filesystem pour une version plus ancienne
donc le test est OK, les versions ultérieures peuvent être supprimées

- produire test-output.json de chaque feature une après l'autre pour node 0.12

- ca serais cool d'avoir des helpers  genre
getAgentVersionSupporting(featureId, agent) -> ['20.0.0']
getAgentSupporting(featureId) -> ['firefox/20', 'node/2']

*/

var path = require('path');

var getFolder = require('./util/get-folder.js');
var pathFromId = require('./util/path-from-id.js');
var idFromNode = require('./util/id-from-node.js');
var mapAsync = require('./util/map-async.js');

var Agent = require('./util/agent.js');
var store = require('./util/store.js');
var fsAsync = require('./util/fs-async.js');
var memoize = require('./util/memoize.js');
var createTranspiler = require('./util/transpiler.js');
var locateSourceMap = require('./util/source-map-locate.js');
var build = require('./util/build.js');
var featureMeta = require('./util/feature-meta.js');
var selectAll = require('./util/select-all.js');
var featureTranspiler = require('./util/feature-transpiler.js');

var rootFolder = path.resolve(__dirname, '../../').replace(/\\/g, '/');
var projectRoot = path.resolve(rootFolder, '../').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var corejsCacheFolder = cacheFolder + '/corejs';
var polyfillCacheFolder = cacheFolder + '/polyfill';

require('../jsenv.js');
var Iterable = jsenv.Iterable;
var Thenable = jsenv.Thenable;

var listAll = require('./list-all.js');
var getBestAgent = require('./get-best-agent.js');

function getTestInstructions(featureIds, agent) {
    return selectAll(
        featureIds,
        'test.js',
        {
            agent: agent,
            include: function(statuses) {
                var testStatus = statuses[0];

                return (
                    testStatus === 'missing' ||
                    testStatus === 'invalid'
                );
            },
            generate: true
        }
    ).then(function(result) {
        return result.code;
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

function setAllTest(records, agent) {
    return featureMeta.setAllTest(
        records,
        agent
    );
}

var debugSolution = !true;
var noSolution = {
    match: function featureHasNoFix(feature) {
        return feature.fix.type === 'none';
    }
};
var inlineSolution = {
    match: function featureUseInlineFix(feature) {
        return feature.fix.type === 'inline';
    }
};
var fileSolution = {
    match: function featureUseFileFix(feature) {
        return feature.fix.type === 'file';
    },

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
        if (debugSolution) {
            console.log('required files', filePaths);
        }
        return mapAsync(filePaths, function(filePath, index) {
            return fsAsync.getFileContent(filePath).then(function(content) {
                return new Function(content); // eslint-disable-line no-new-func
            }).then(function(fileFunction) {
                var feature = features[index];
                var abstractFeature = Iterable.find(abstractFeatures, function(abstractFeature) {
                    return abstractFeature.id.from === feature.id;
                });
                abstractFeature.fixFunction = {
                    type: 'inline',
                    name: '',
                    from: fileFunction
                };
            });
        });
    }
};
var coreJSSolution = {
    match: function featureUseCoreJSFix(feature) {
        return feature.fix.type === 'corejs';
    },

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
        if (debugSolution) {
            console.log('required moduleNames', moduleNames);
        }

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
                    behaviour: 'branch',
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
    match: function featureUseBabelFix(feature) {
        return feature.fix.type === 'babel';
    },

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
        var generatorPlugin = Iterable.find(plugins, function(plugin) {
            return plugin.name === 'transform-regenerator';
        });
        // var asyncPlugin = Iterable.find(plugins, function(plugin) {
        //     return plugin.name === 'transform-async-to-generator';
        // });
        // transform-regenerator does not enable babel-plugin-syntax-async-functions
        // but transform-async-to-generator does
        // fix by always ensuring babel-plugin-syntax-async-functions is present when needed
        if (generatorPlugin) {
            pluginsAsOptions.unshift([
                'babel-plugin-syntax-async-functions',
                {}
            ]);
        }
        if (debugSolution) {
            console.log('required babel plugins', pluginsAsOptions.map(function(pluginOption) {
                return pluginOption[0];
            }));
        }

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
                ignoreSyntaxError: true,
                sourceMaps: false,
                sourceURL: false,
                // disable cache to prevent race condition with the transpiler
                // that will use this plugin (it's the parent transpiler which is reponsible to cache)
                cache: false
            });
            return result;
        }, 'transpile');
        var fixedTranspiler = featureTranspiler.clone();
        fixedTranspiler.options.plugins.unshift(
            [transpileTemplatePlugin, babelTranspiler.getNormalizedPlugins()]
        );
        options.transpiler = fixedTranspiler;
        return Promise.resolve(fixedTranspiler);
    }
};
function filterBySolution(features, solution, abstractFeatures) {
    var i = 0;
    var j = features.length;
    var matches = [];
    var index = 0;
    while (i < j) {
        var feature = features[i];
        var existingFix = Iterable.find(matches, function(match) { // eslint-disable-line
            return match.fix === feature.fix;
        });
        if (existingFix) {
            // remove ducplicate fix from abstractFeatures (no need to fix them)
            if (abstractFeatures) {
                // also remove the fix dependending on this one
                abstractFeatures.forEach(function(abstractFeature) { // eslint-disable-line
                    if ('fixDependencies' in abstractFeature) {
                        Iterable.remove(abstractFeature.fixDependencies.from, index + 1);
                    }
                });
                abstractFeatures.splice(i, 1);
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
        index++;
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
    return selectAll(
        featureIdsToTest,
        'test.js'
    ).then(function(result) {
        // first we need to know where the merged value will be in the final array
        // we'll use abstractIndexes array which behaves as follow
        // given abstractFeature = [a, b, c]
        // and testFeatures = [b, d, a, e]
        // then abstractIndexes will be [1, 3, 0, 4]
        // because b is at 1, d will be added at 3, a at 0, e will be added at 4

        var abstractTestFeatures = result.abstractFeatures;
        var abstractIndexes = [];
        var newCount = 0;
        abstractTestFeatures.forEach(function(abstractTestFeature) {
            var abstractFeatureIndex = Iterable.findIndex(abstractFeatures, function(abstractFeature) {
                return abstractFeature.id.from === abstractTestFeature.id.from;
            });

            if (abstractFeatureIndex === -1) {
                abstractIndexes.push(abstractFeatures.length + newCount);
                newCount++;
            } else {
                abstractIndexes.push(abstractFeatureIndex);
            }
        });

        function isNewValue(index) {
            return index >= abstractFeatures.length;
        }
        function getFinalIndex(index) {
            return abstractIndexes.indexOf(index);
        }

        abstractIndexes.forEach(function(abstractIndex, index) {
            var abstractTestFeature = abstractTestFeatures[index];

            // abstractTestFeatures are injected inside abstractFeatures
            // as a consequence testDependencies must be updated to target the right nodes
            abstractTestFeature.testDependencies.from = abstractTestFeature.testDependencies.from.map(getFinalIndex);

            if (isNewValue(abstractIndex)) {
                abstractFeatures.push(abstractTestFeature);
            } else {
                var abstractFeature = abstractFeatures[abstractIndex];
                abstractFeature.test = abstractTestFeature.test;
                abstractFeature.testDependencies = abstractTestFeature.testDependencies;
            }
        });
    });
}
function getFixInstructions(featureIds, agent) {
    var selectFixOptions = {
        agent: agent,
        needFixStatus: true,
        fallbackBestAgentStatus: true,
        include: function(statuses, node, nodeIsDependency) {
            var testStatus = statuses[0];
            var fixStatus = statuses[1];
            var include = (
                (
                    testStatus === 'missing' ||
                    testStatus === 'invalid' ||
                    testStatus === 'failed'
                ) &&
                (
                    nodeIsDependency || (
                        fixStatus === 'missing' ||
                        fixStatus === 'invalid'
                    )
                )
            );
            console.log('including', idFromNode(arguments[1]), '?', include, 'for status', testStatus, fixStatus);
            return include;
        },
        ignoreDependencies: true,
        instantiate: true
    };

    return selectAll(
        featureIds,
        'fix.js',
        selectFixOptions
    ).then(function(result) {
        var nodes = result.nodes;
        var abstractFeatures = result.abstractFeatures;
        var features = result.features;
        var groups = groupBySolution(features, abstractFeatures);
        var buildOptions = {
            root: getFolder(),
            transpiler: featureTranspiler,
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
            nodes,
            abstractFeatures,
            buildOptions
        );
        pending.push(loadTestThenable);

        return Thenable.all(pending).then(function() {
            if (debugSolution) {
                // console.log('resulting abstract features', abstractFeatures.map(function(abstractFeature) {
                //     return {
                //         id: abstractFeature.id.from,
                //         willBeFixed: abstractFeature.hasOwnProperty('fix'),
                //         hasFixFunction: abstractFeature.hasOwnProperty('fixFunction'),
                //         willBeTested: abstractFeature.hasOwnProperty('test')
                //     };
                // }));
            }

            return build(
                abstractFeatures,
                buildOptions
            ).then(function(bundle) {
                return bundle.code;
            });
        });
    });
}
// getFixInstructions(
//     ['function/async'],
//     jsenv.agent
// ).then(function() {
//     console.log('got fix instructions');
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function setAllFix(records, agent) {
    return featureMeta.setAllFix(
        records,
        agent
    );
}

function createOwnMediator(featureIds, agent) {
    agent = Agent.parse(agent);

    return {
        send: function(action, value) {
            if (action === 'getTestInstructions') {
                return getTestInstructions(featureIds, agent).then(fromServer);
            }
            if (action === 'setAllTest') {
                return setAllTest(value, agent);
            }
            if (action === 'getFixInstructions') {
                return getFixInstructions(featureIds, agent).then(fromServer);
            }
            if (action === 'setAllFix') {
                return setAllFix(value, agent);
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
//         'function/async'
//     ],
//     jsenv.agent
// );
// var client = jsenv.createImplementationClient(ownMediator);
// client.scan().then(function() {
//     console.log('scan done');
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function createFixClientOptions(agent) {
    var fixClientOptions = {
        file: 'fix.js',
        agent: agent,
        needFixStatus: true,
        fallbackBestAgentStatus: true,
        include: function(statuses) {
            var testStatus = statuses[0];
            var fixStatus = statuses[1];
            var include = (
                testStatus === 'missing' ||
                testStatus === 'invalid' ||
                (
                    testStatus === 'failed' && (
                        fixStatus === 'missing' ||
                        fixStatus === 'invalid' ||
                        fixStatus === 'passed'
                    )
                )
            );
            return include;
        },
        ignoreDependencies: true,
        instantiate: true
    };
    return fixClientOptions;
}
function polyfill(featureIds, agent, minify) {
    minify = false; // for now disable minifcation

    return selectAll(
        featureIds,
        'fix.js',
        createFixClientOptions(agent)
    ).then(function(result) {
        var abstractFeatures = result.abstractFeatures;
        var featuresToFix = result.features;
        var groups = groupBySolution(featuresToFix, abstractFeatures);
        var buildOptions = {
            root: getFolder(),
            transpiler: featureTranspiler,
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
                sources: sources,
                save: function(filename, result) {
                    var relativeSourceMapUrl = path.basename(filename) + '.map';
                    var sourceMapUrl = path.dirname(filename) + '/' + relativeSourceMapUrl;
                    result.code += '\n//# sourceMappingURL=' + relativeSourceMapUrl;
                    locateSourceMap(result.map, filename);
                    return Promise.all([
                        fsAsync.setFileContent(filename, result.code),
                        fsAsync.setFileContent(sourceMapUrl, JSON.stringify(result.map))
                    ]);
                }
            });
            return entry.get(abstractFeatures).then(function(data) {
                if (data.valid) {
                    return data.path;
                }

                if (minify) {
                    buildOptions.transpiler = buildOptions.transpiler.minify();
                }
                return build(
                    abstractFeatures,
                    buildOptions
                ).then(function(bundle) {
                    return entry.set(bundle, abstractFeatures).then(function(data) {
                        return data.path;
                    });
                });
            });
        });
    });
}
// polyfill(
//     ['function/async'],
//     jsenv.agent,
//     true
// ).then(function(polyfill) {
//     console.log('polyfill path', polyfill);
//     // eval(String(require('fs').readFileSync(polyfill)));
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function getNodeFilename(filename) {
    var nodeFilename;
    if (filename.indexOf('file:///') === 0) {
        nodeFilename = filename.slice('file:///'.length);
    } else {
        nodeFilename = filename;
    }
    return nodeFilename;
}
function transpile(file, featureIds, agent) {
    file = path.resolve(getNodeFilename(file)).replace(/\\/g, '/');
    // console.log('the file to transpile', file);

    return selectAll(
        featureIds,
        'fix.js',
        createFixClientOptions(agent)
    ).then(function(result) {
        var featuresToFix = result.features;
        var groups = groupBySolution(featuresToFix);
        var transpiler = babelSolution.createTranspiler(groups.babel);
        return transpiler.transpileFile(file, {
            onlyPath: true,
            as: 'module'
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

function install() {
    var agent = jsenv.agent;
    var features = [
        'for-of',
        'destructuring',
        'function/parameters',
        'function/arrow',
        'block-scoping',
        'shorthand-notation',
        'template-literals',
        'url',
        'url-search-params'
    ];

    function setup() {
        return polyfill(features, agent).then(function(polyfill) {
            return fsAsync.getFileContent(polyfill).then(function(js) {
                eval(js);
            });
        });
    }

    function createSystem() {
        // https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js
        var SystemJS = require('systemjs');
        var mySystem = new SystemJS.constructor();
        var instantiateMethod = SystemJS.constructor.instantiate;
        mySystem[instantiateMethod] = function(key, processAnonRegister) {
            var filename = getNodeFilename(key);
            // console.log('the key', key);

            if (filename.slice(0, 2) === '//') {
                filename = projectRoot + '/' + filename.slice(2);
            } else if (filename[0] === '/') {
                filename = rootFolder + '/' + filename.slice(2);
            } else {
                filename = rootFolder + '/' + filename;
            }

            return transpile(filename, features, agent).then(function(transpiledFilename) {
                return fsAsync.getFileContent(transpiledFilename);
            }).then(function(source) {
                global.System = mySystem;
                eval(source);
                delete global.System;
                processAnonRegister();
            });
        };
        return mySystem;
    }

    function configSystem(System) {
        function createModuleExportingDefault(defaultExportsValue) {
            return System.newModule({
                "default": defaultExportsValue // eslint-disable-line quote-props
            });
        }
        function registerCoreModule(moduleName, defaultExport) {
            System.registry.set(moduleName, createModuleExportingDefault(defaultExport));
        }
        function prefixModule(name) {
            var prefix = jsenv.modulePrefix;
            var prefixedName;
            if (prefix) {
                prefixedName = prefix + '/' + name;
            } else {
                prefixedName = name;
            }

            return prefixedName;
        }

        System.meta['*.json'] = {format: 'json'};
        System.config({
            map: {
                '@jsenv/compose': '/node_modules/jsenv-compose/index.js'
            }
        });
        [
            'iterable',
            'thenable',
            'rest',
            'timeout',
            'url'
        ].forEach(function(libName) {
            var libPath = '/src/server/' + libName + '/index.js';
            var map = {};
            map[prefixModule(libName)] = libPath;
            System.config({
                map: map
            });
        }, this);
        registerCoreModule(prefixModule(jsenv.rootModuleName), jsenv);
        registerCoreModule(prefixModule(jsenv.moduleName), jsenv);
        registerCoreModule('@node/require', require);

        var oldImport = System.import;
        System.import = function() {
            return oldImport.apply(this, arguments).catch(function(error) {
                if (error && error instanceof Error) {
                    var originalError = error;
                    while ('originalErr' in originalError) {
                        originalError = originalError.originalErr;
                    }
                    return Promise.reject(originalError);
                }
                return error;
            });
        };

        return System.import('/src/api/config-system.js').then(function(exports) {
            return exports.default();
        }).then(function() {
            return System;
        });
    }

    return setup().then(createSystem).then(configSystem).then(function() {

    });
}
install().then(function() {
    console.log('installed');
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

var api = {};
api.getFolder = getFolder;
api.getFeaturePath = pathFromId;
api.getAllAvailableIds = listAll;
api.getBestAgent = getBestAgent;

api.getTestInstructions = getTestInstructions;
api.setTest = featureMeta.setTest;
api.setAllTest = setAllTest;
api.getFixInstructions = getFixInstructions;
api.setFix = featureMeta.setFix;
api.setAllFix = setAllFix;
api.createOwnMediator = createOwnMediator;

api.polyfill = polyfill;
api.transpile = transpile;
api.install = install;

module.exports = api;
