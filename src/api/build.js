/*

- lorsqu'un noeud est importé que par des noeuds useless
ce noeud devient useless, ce n'est pas le cas pour le moment

-> à retester, c'est censé fonctionner
en gros fix-helpers ne doit pas faire partie du build lorsqu'on exclue
string/prototype/at/fix.js

*/

var Builder = require('systemjs-builder');

var createTranspiler = require('./util/transpiler.js');
var mapAsync = require('./util/map-async.js');

var root = require('path').resolve(process.cwd(), '../../').replace(/\\/g, '/');
var variables = {
    platform: 'node',
    __esModule: true
};

function variablesToConditions(variables) {
    var conditions = {};
    Object.keys(variables).forEach(function(name) {
        conditions['@env|' + name] = variables[name];
    });
    return conditions;
}
function trace(entry) {
    var baseURL = 'file:///' + root;
    var builder = new Builder(baseURL);
    var loader = builder.loader;

    builder.config({
        map: {
            'core-js': 'node_modules/core-js',
            'jsenv': '/'
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

    return builder.trace(entry, {
        conditions: variablesToConditions(variables)
    }).then(function(tree) {
        return {
            builder: builder,
            tree: tree
        };
    });
}
function getNodes(tree) {
    return Object.keys(tree).map(function(name) {
        return tree[name];
    }).filter(function(node) {
        if (typeof node === 'boolean') { // for thoose with build: false
            return false;
        }
        return 'conditional' in node === false;
    });
}
function isUrlUseless(filename) {
    var featureFolderUrl = 'file:///' + root + '/src/features/';
    if (filename.indexOf(featureFolderUrl) === 0) {
        var ressource = filename.slice(featureFolderUrl.length);
        var featureName = ressource.split('/').slice(0, -1).join('/');
        if (featureName) {
            // console.log('is feature useless', featureName);
            return true;
        }
        return false;
    }
    return false;
}
function collectDeadImports(entry, tree, builder, agent) {
    var nodes = getNodes(tree);

    return mapAsync(nodes, function(node) {
        return builder.loader.normalize(node.name).then(function(loc) {
            return isUrlUseless(loc, agent);
        });
    }).then(function(uselessFlags) {
        function getDependencies(node) {
            return Object.keys(node.depMap).map(function(name) {
                var dependencyName = node.depMap[name];
                var dependency = tree[dependencyName];
                return dependency;
            });
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
                status === 'all-dependents-are-dead' ||
                status === 'no-dependents'
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
                console.log('mark', node.name, 'as dead');
            }
        });
        var deadImports = [];
        var nodesToRemove = [];
        var dependenciesToRemove = [];
        nodes.forEach(function(node) {
            var status = getStatus(node);
            if (isDeadStatus(status)) {
                console.log(node.name, 'removed from tree because', status);
                nodesToRemove.push(node);
            } else {
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
        console.log('the dead imports', deadImports);
        return deadImports;
    });
}
function injectImportRemovalPlugin(entry, tree, transpiler, builder, agent) {
    return collectDeadImports(entry, tree, builder, agent).then(function(deadImports) {
        var importRemovalPlugin = createTranspiler.removeImport(function(importee, importer) {
            console.log('importee', importee, 'importer', importer, 'deads', deadImports);
            var isUseless = deadImports.some(function(description) {
                return (
                    importee === description.key &&
                    importer === description.parentName
                );
            });
            // console.log('from', importee, 'useless?', isUseless);
            return isUseless;
        });

        transpiler.options.plugins.unshift(importRemovalPlugin);
    });
}
function transpile(entry, tree, transpiler, builder, agent) {
    return injectImportRemovalPlugin(entry, tree, transpiler, builder, agent).then(function() {
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
function build(entry, agent) {
    return trace(entry).then(function(result) {
        var tree = result.tree;
        var builder = result.builder;
        var loader = builder.loader;
        var transpiler = createTranspiler({
            cache: false,
            sourceMaps: true,
            plugins: [
                'babel-plugin-transform-es2015-modules-systemjs'
            ]
        });

        return transpile(entry, tree, transpiler, builder, agent).then(function() {
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

            var buildOutputPath = root + '/build/' + hash + '/build.js';
            return builder.bundle(tree, buildOutputPath, {
                sourceMaps: true
            }).then(function() {
                return buildOutputPath;
            });
        });
    });
}

module.exports = build;

build('examples/entry.js').then(function(path) {
    console.log('build path', path);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

function consume() {
    var SystemJS = require('systemjs');
    var System = new SystemJS.constructor();
    System.config({
        baseURL: 'file:///' + root,
        transpiler: undefined,
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
    // var resolveSymbol = System.constructor.resolve;
    // var resolve = System[resolveSymbol];
    // System[resolveSymbol] = createConsistentResolver(resolve, System);
    global.System = System;
    // System.trace = true;
    // console.log('before eval sys', System);
    var code = require('fs').readFileSync('./outfile.js').toString();
    var vm = require('vm');
    vm.runInThisContext(code, {filename: 'outfile.js'});

    // console.log('before import sys', System);
    return System.import('examples/build/object-assign.js').then(function(exports) {
        // console.log('after import', System);
        console.log('exports', exports);
    }).catch(function(e) {
        console.log('error', e.stack);
    });
}
build.consume = consume;
