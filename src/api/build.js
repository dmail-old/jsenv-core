/*

- il faudra que le systemjs que j'utilise ait un [resolve] qui lui aussi
fix le fait que file:/// ne résoud pas pareil les imports commencant par /

- lorsqu'un noeud est importé que par des noeuds useless
ce noeud devient useless, ce n'est pas le cas pour le moment

*/

var Builder = require('systemjs-builder');

var createTranspiler = require('./util/transpiler.js');
var mapAsync = require('./util/map-async.js');

var root = require('path').resolve(process.cwd(), '../../').replace(/\\/g, '/');

function variablesToConditions(variables) {
    var conditions = {};
    Object.keys(variables).forEach(function(name) {
        conditions['@env|' + name] = variables[name];
    });
    return conditions;
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
function collectUselessImports(tree, builder, agent) {
    var nodes = getNodes(tree);

    return mapAsync(nodes, function(node) {
        return builder.loader.normalize(node.name).then(function(loc) {
            return isUrlUseless(loc, agent);
        });
    }).then(function() {
        // var uselessNodes = nodes.filter(function(node, index) {
        //     return uselessFlags[index];
        // });
        var uselessImports = [];
        // l'idée c'est que tous les noeuds useless doivent être supprimé du tree
        // en plus de ça tous les noeuds importé par ces noeuds useless deviennent useless
        // s'il ne sont pas référencé ailleurs
        // et lorsque cette référence est perdu il faut alors check si le dit noeud n'en invalide pas d'autre
        // une sorte de garbage collect weak

        // function propagateUselessState() {
        //     uselessNodes.forEach(function(uselessNode) {
        //         delete tree[uselessNode.name];

        //         usedNodes.forEach(function(node) {
        //             var dependencies = node.depMap ? Object.keys(node.depMap).map(function(key) {
        //                 return {
        //                     key: key,
        //                     name: node.depMap[key]
        //                 };
        //             }) : [];
        //             var uselessDependency = dependencies.find(function(dependency) {
        //                 return dependency.name === uselessNode.name;
        //             });
        //             if (uselessDependency) {
        //                 uselessImports.push({
        //                     dependency: uselessDependency,
        //                     parent: node
        //                 });
        //                 delete node.depMap[uselessDependency.key];
        //                 node.deps.splice(node.deps.indexOf(uselessDependency.name), 1);
        //             }
        //         });
        //     });
        // }
        // propagateUselessState();

        return uselessImports;
    });
}
function normalizeRootKey(key, loader) {
    if (key[0] === '/' && key[1] !== '/') {
        var baseURL = loader.baseURL;
        if (baseURL.indexOf('file:///') === 0) {
            return baseURL + key.slice(1);
        }
    }
    return key;
}
function injectImportRemovalPlugin(tree, transpiler, builder, agent) {
    return collectUselessImports(tree, builder, agent).then(function(uselessImports) {
        return mapAsync(uselessImports, function(info) {
            return builder.loader.normalize(info.dependency.key);
        });
    }).then(function(importsToRemove) {
        var importRemovalPlugin = createTranspiler.removeImport(function(path) {
            var from = builder.loader.normalizeSync(
                normalizeRootKey(path.node.source.value, builder.loader)
            );
            var isUseless = importsToRemove.some(function(id) {
                return id === from;
            });
            console.log('from', from, 'useless?', isUseless);
            return isUseless;
        });

        transpiler.options.plugins.unshift(importRemovalPlugin);
    });
}
function transpile(tree, transpiler, builder, agent) {
    return injectImportRemovalPlugin(tree, transpiler, builder, agent).then(function() {
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
function isUrlUseless(filename) {
    var featureFolderUrl = 'file:///' + root + '/src/features/';
    if (filename.indexOf(featureFolderUrl) === 0) {
        var ressource = filename.slice(featureFolderUrl.length);
        var featureName = ressource.split('/').slice(0, -1).join('/');
        if (featureName) {
            console.log('is feature useless', featureName);
            return true;
        }
        return false;
    }
    return false;
}

function build(entry, agent) {
    var baseURL = 'file:///' + root;
    var builder = new Builder(baseURL);
    var loader = builder.loader;
    var variables = {
        platform: 'node',
        __esModule: true
    };

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
    // fix the fact file:/// & http:/// resolution differs for import starting by /
    var normalize = loader.normalize;
    loader.normalize = function(key, parentKey) {
        key = normalizeRootKey(key, loader);
        return normalize.call(this, key, parentKey);
    };

    return builder.trace(entry, {
        conditions: variablesToConditions(variables)
    }).then(function(tree) {
        var transpiler = createTranspiler({
            cache: false,
            sourceMaps: true,
            plugins: [
                'babel-plugin-transform-es2015-modules-systemjs'
            ]
        });

        return transpile(tree, transpiler, builder, agent).then(function() {
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

// function consume() {
//     var SystemJS = require('systemjs');
//     var System = new SystemJS.constructor();
//     System.config({
//         baseURL: 'file:///' + root,
//         transpiler: undefined,
//         map: {
//             'core-js': 'node_modules/core-js'
//         },
//         packages: {
//             'core-js': {
//                 main: 'index.js',
//                 format: 'cjs',
//                 defaultExtension: 'js'
//             }
//         }
//     });

//     global.System = System;
//     // System.trace = true;
//     // console.log('before eval sys', System);
//     var code = require('fs').readFileSync('./outfile.js').toString();
//     var vm = require('vm');
//     vm.runInThisContext(code, {filename: 'outfile.js'});

//     // console.log('before import sys', System);
//     return System.import('examples/build/object-assign.js').then(function(exports) {
//         // console.log('after import', System);
//         console.log('exports', exports);
//     }).catch(function(e) {
//         console.log('error', e.stack);
//     });
// }
