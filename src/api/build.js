/*

- tester consume tout court, qui ne build pas mais doit se comporter comme le builder

*/

var Builder = require('systemjs-builder');

var createTranspiler = require('./util/transpiler.js');
var mapAsync = require('./util/map-async.js');
// var resolveIfNotPlain = require('./util/resolve-if-not-plain.js');
// function resolve(importee, importer) {
//     var location;
//     var resolved = resolveIfNotPlain(importee, importer);
//     if (resolved === undefined) {
//         location = rootHref + '/' + importee;
//     } else {
//         location = resolved;
//     }
//     return location;
// }

var root = require('path').resolve(process.cwd(), '../../').replace(/\\/g, '/');
var rootHref = 'file:///' + root;
// ptet qu'on écrire ça dans un fichier et qu'on
// modifiera ce qui est écris dans le fichier par un code éxécute en amont de l'envoi du fichier
// on pourrait écrire le fichier comme suit:
/*
export platform = meta`(() => {
    // do stuff to return the platform we are in
})()`
export mode = meta`(() => {
    return 'production';
})()`
*/
var variables = {
    platform: 'node',
    __esModule: true
};

function getProfile() {
    return {
        'string/prototype/at': {test: 'passed'}
    };
}
function isImportUseless(loader, profile, importee, importer) {
    var resolveSync = (loader.resolveSync || loader.normalizeSync).bind(loader);

    var location = resolveSync(importee, importer);
    var featureFolderLocation = resolveSync('src/features');
    if (location.indexOf(featureFolderLocation) === 0) {
        var ressource = location.slice(featureFolderLocation.length + 1);
        var featureName = ressource.split('/').slice(0, -1).join('/');
        if (featureName && featureName in profile) {
            var featureInfo = profile[featureName];
            return featureInfo.test === 'passed';
        }
        return false;
    }
    return false;
}
function variablesToConditions(variables) {
    var conditions = {};
    Object.keys(variables).forEach(function(name) {
        conditions['@env|' + name] = variables[name];
    });
    return conditions;
}
function isConcreteNode(node) {
    // thoose with build: false set by builder.config({meta: 'a': {build: false}});
    if (typeof node === 'boolean') {
        return false;
    }
    // conditional branch
    return 'conditional' in node === false;
}
function getNodes(tree) {
    return Object.keys(tree).map(function(name) {
        return tree[name];
    }).filter(isConcreteNode);
}
function collectDeadImports(loader, entry, tree, agent) {
    // console.log('the tree', tree);
    // console.log('branches', tree['examples/build/plat/#{@env|platform}.js'].conditional.branches);

    return Promise.resolve(getProfile(agent)).then(function(profile) {
        var nodes = getNodes(tree);

        return mapAsync(nodes, function(node) {
            return isImportUseless(loader, profile, node.name, entry);
        }).then(function(uselessFlags) {
            function getDependencies(node) {
                return Object.keys(node.depMap).map(function(name) {
                    var dependencyName = node.depMap[name];
                    var dependency = tree[dependencyName];
                    return dependency;
                }).filter(isConcreteNode);
            }
            function getDependents(node) {
                var dependents = [];
                nodes.forEach(function(possibleDependentNode) {
                    if (possibleDependentNode !== node) {
                        var dependencies = getDependencies(possibleDependentNode);
                        var dependency = dependencies.find(function(dependency) {
                            return dependency.name === node.name;
                        });
                        if (dependency) {
                            dependents.push(possibleDependentNode);
                        }
                    }
                });
                return dependents;
            }
            function isDeadStatus(status) {
                return (
                    status === 'useless' ||
                    status === 'all-dependents-are-dead'
                    // status === 'no-dependents'
                );
            }
            function getStatus(node) {
                if (node.name === entry) {
                    return 'entry';
                }
                if (node.metadata.dead) {
                    return 'useless';
                }
                var dependents = getDependents(node);
                if (dependents.length === 0) {
                    return 'no-dependents'; // not supposed to happen
                }
                var allDependentsAreDead = dependents.every(function(dependent) {
                    var referenceStatus = getStatus(dependent);
                    return isDeadStatus(referenceStatus);
                });
                if (allDependentsAreDead) {
                    return 'all-dependents-are-dead';
                }
                return 'alive';
            }
            nodes.forEach(function(node, index) {
                var isUseless = uselessFlags[index];
                if (isUseless) {
                    node.metadata.dead = true;
                    // console.log('mark', node.name, 'as dead');
                }
            });
            var deadImports = [];
            var nodesToRemove = [];
            var dependenciesToRemove = [];
            nodes.forEach(function(node) {
                var status = getStatus(node);
                if (isDeadStatus(status)) {
                    // console.log(node.name, 'removed from tree because', status);
                    nodesToRemove.push(node);
                } else {
                    // console.log(node.name, 'kept in tree because', status);
                    getDependencies(node).forEach(function(dependency) {
                        var dependencyStatus = getStatus(dependency);
                        if (isDeadStatus(dependencyStatus)) {
                            Object.keys(node.depMap).forEach(function(key) {
                                if (node.depMap[key] === dependency.name) {
                                    dependenciesToRemove.push({
                                        node: node,
                                        key: key,
                                        name: dependency.name
                                    });
                                }
                            });
                        }
                    });
                }
            });
            nodesToRemove.forEach(function(node) {
                delete tree[node.name];
            });
            dependenciesToRemove.forEach(function(how) {
                var node = how.node;
                var key = how.key;
                var name = how.name;

                delete node.depMap[key];
                node.deps.splice(node.deps.indexOf(name), 1);
                deadImports.push({
                    parentName: node.name,
                    name: name,
                    key: key
                });
            });
            return deadImports;
        });
    });
}
function injectImportRemovalPlugin(loader, entry, tree, transpiler, agent) {
    return collectDeadImports(loader, entry, tree, agent).then(function(deadImports) {
        var importRemovalPlugin = createTranspiler.removeImport(function(importee, importer) {
            var isUseless = deadImports.some(function(description) {
                return (
                    importee === description.key &&
                    importer === description.parentName
                );
            });
            // console.log('importee', importee, 'importer', importer, 'useless?', isUseless);
            return isUseless;
        });

        transpiler.options.plugins.unshift(importRemovalPlugin);
    });
}
function transpile(loader, entry, tree, transpiler, agent) {
    return injectImportRemovalPlugin(loader, entry, tree, transpiler, agent).then(function() {
        var nodes = getNodes(tree);

        return mapAsync(nodes, function(node) {
            return Promise.resolve(
                transpiler.transpile(node.source, {
                    filename: node.path,
                    moduleId: node.name
                })
            ).then(function(result) {
                node.source = result.code;

                node.metadata.format = 'system';
                node.metadata.sourceMap = result.map;
                if (result.ast) {
                    node.metadata.ast = result.ast;
                }
            });
        });
    });
}
function getTranspiler() {
    var transpiler = createTranspiler({
        cache: false,
        sourceMaps: true,
        plugins: [
            'babel-plugin-transform-es2015-modules-systemjs'
        ]
    });
    return transpiler;
}
function setupLoader(loader) {
    loader.config({
        // baseURL: rootHref,
        // transpiler: undefined,
        map: {
            'core-js': 'node_modules/core-js'
        },
        packages: {
            'core-js': {
                main: 'index.js',
                format: 'cjs',
                defaultExtension: 'js'
            }
        }
    });
    loader.set('@env', loader.newModule(variables));

    // var resolveSymbol = loader.constructor.resolve;
    // var resolve = loader[resolveSymbol];
    // loader[resolveSymbol] = createConsistentResolver(resolve, loader);
    // loader.trace = true;
}
function build(entry, agent) {
    var builder = new Builder(rootHref);
    var loader = builder.loader;
    setupLoader(loader);

    return builder.trace(entry, {
        conditions: variablesToConditions(variables)
    }).then(function(tree) {
        var transpiler = getTranspiler();

        return transpile(loader, entry, tree, transpiler, agent).then(function() {
            var hash = loader.configHash;

            tree['@env'] = {
                name: '@env',
                path: null,
                metadata: {
                    format: 'json'
                },
                deps: [],
                depMap: {},
                source: JSON.stringify(variables),
                fresh: true,
                timestamp: null,
                configHash: hash
            };
            // console.log('final tree', Object.keys(tree));

            var buildOutputPath = root + '/build/' + hash + '/build.js';
            return builder.bundle(tree, buildOutputPath, {
                sourceMaps: true
            }).then(function() {
                return buildOutputPath;
            });
        });
    });
}
// build('examples/entry.js').then(function(path) {
//     console.log('build path', path);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function createSystem() {
    var SystemJS = require('systemjs');
    var System = new SystemJS.constructor();
    setupLoader(System);
    return System;
}
function consumeBuild() {
    var System = createSystem();
    global.System = System;

    var buildPath = root + '/build/63c9ddd5b47ce990f3be45ffed733252/build.js';
    var code = require('fs').readFileSync(buildPath).toString();
    var vm = require('vm');
    vm.runInThisContext(code, {filename: buildPath});

    return System.import('examples/entry.js');
}
// consumeBuild('examples/entry.js').then(function(exports) {
//     console.log('export', exports);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function getNodeFilename(filename) {
    filename = String(filename);

    var nodeFilename;
    if (filename.indexOf('file:///') === 0) {
        nodeFilename = filename.slice('file:///'.length);
    } else {
        nodeFilename = filename;
    }
    return nodeFilename;
}
function consume(entry, agent) {
    var System = createSystem();
    global.System = System;
    System.registry.set('@env', System.newModule(variables));

    entry = System.resolveSync(entry, rootHref);

    var instantiate = System[instantiateMethod];
    var instantiateMethod = System.constructor.instantiate;
    var transpiler = getTranspiler();
    System[instantiateMethod] = function(key, processAnonRegister) {
        if (key.indexOf('@node/') === 0) {
            return instantiate.apply(this, arguments);
        }

        return Promise.resolve(getProfile(agent)).then(function(profile) {
            var importRemovalPlugin = createTranspiler.removeImport(function(importee, importer) {
                return isImportUseless(System, profile, importee, importer);
            });

            transpiler.options.plugins.unshift(importRemovalPlugin);
            var filename = getNodeFilename(key);
            return transpiler.transpileFile(filename).then(function(result) {
                global.System = System;
                var vm = require('vm');
                vm.runInThisContext(result.code, {filename: filename});
                delete global.System;
                processAnonRegister();
            });
        });
    };

    return System.import(entry);
}
// consume('examples/entry.js').then(function(exports) {
//     console.log('export', exports);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

build.consumeBuild = consumeBuild;
build.consume = consume;
module.exports = build;
