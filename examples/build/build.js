/*

- exporter une fonction: build(path)
qui retourne le code à éxécuter (devrais retourne le path vers un fichier plutôt)

- keep in mind : Promise & SystemJS are not added in the build, they must be provided
before. The may be auto included ine the build one day.
But to do this I must be able to prepend raw js code in the build, currently not possible.

*/
// var path = require('path');
var Builder = require('systemjs-builder');
var root = require('path').resolve(process.cwd(), '../../').replace(/\\/g, '/');
var builder = new Builder('file:///' + root);
builder.config({
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
builder.loader.set('@env', builder.loader.newModule(variables));

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
var createTranspiler = require('../../src/api/util/transpiler.js');
var transpiler = createTranspiler({
    cache: false,
    sourceMaps: true,
    plugins: [
        'babel-plugin-transform-es2015-modules-systemjs'
    ]
});
function transpile(source, filename, moduleId) {
    return transpiler.transpile(source, {
        filename: filename,
        moduleId: moduleId
    });
}
var mapAsync = require('../../src/api/util/map-async.js');
function transpileNodes(nodes) {
    return mapAsync(nodes, function(node) {
        return Promise.resolve(transpile(node.source, node.path, node.name)).then(function(result) {
            node.source = result.code;

            node.metadata.format = 'system';
            node.metadata.sourceMap = result.map;
            if (result.ast) {
                node.metadata.ast = result.ast;
            }
        });
    });
}

builder.trace('examples/build/object-assign.js', {
    conditions: variablesToConditions(variables)
}).then(function(tree) {
    var nodes = getNodes(tree);

    var uselessNodes = nodes.filter(function(node) {
        return node.name === 'dir/mock.js';
    });
    var usedNodes = nodes.filter(function(node) {
        return uselessNodes.some(function(uselessNode) {
            return uselessNode.name !== node.name;
        });
    });
    var importsToRemove = [];
    uselessNodes.forEach(function(uselessNode) {
        usedNodes.forEach(function(node) {
            var dependencies = node.depMap ? Object.keys(node.depMap).map(function(key) {
                return {
                    key: key,
                    name: node.depMap[key]
                };
            }) : [];
            var uselessDependency = dependencies.find(function(dependency) {
                return dependency.name === uselessNode.name;
            });
            if (uselessDependency) {
                importsToRemove.push({
                    dependency: uselessDependency,
                    parent: node
                });
                delete node.depMap[uselessDependency.key];
                node.deps.splice(node.deps.indexOf(uselessDependency.name), 1);
            }
        });
        delete tree[uselessNode.name];
    });

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
        configHash: builder.loader.configHash
    };

    var System = require('systemjs');
    return mapAsync(importsToRemove, function(info) {
        return System.resolveSync(info.dependency.key);
    }).then(function(toBeRemoved) {
        transpiler.options.plugins.unshift(
            createTranspiler.removeImport(function(path) {
                var from = System.resolveSync(path.node.source.value);
                return toBeRemoved.some(function(id) {
                    return id === from;
                });
            })
        );

        return transpileNodes(usedNodes).then(function() {
            return builder.bundle(tree, 'outfile.js', {
                sourceMaps: true
            });
        });
    }).then(function() {
        return consume();
    });
}).then(function() {
    console.log('build complete');
}).catch(function(err) {
    console.log('error');
    console.log(err.stack);
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
