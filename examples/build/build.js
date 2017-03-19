/*
conceptuellement je dirais qu'on est bon:
c'est à dire qu'on peut supprimer certains import du build

par contre il reste encore :

à ajouter systemjs au build au début du polyfill
à ajouter du code en aval du polyfill qui fera kk chose comme

System.import('polyfill');

enfin non c'est pas vraiment requis en vérité il "suffit" de faire System.import('main.js')
pour que tous les fix.js requis s'éxécute donc ça c'est bon

donc en gros j'aurais besoin d'une méthode genre build()
qui va retourner la source nécéssaire pour build

et d'une méthode run(entryModule)

qui va appeler build + faire System.import(entryModule) ensuite

*/
// var path = require('path');
var Builder = require('systemjs-builder');
var builder = new Builder('./');
builder.config({

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

builder.trace('object-assign.js', {
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
        transpiler: undefined
    });

    global.System = System;
    System.trace = true;
    // console.log('before eval sys', System);
    var code = require('fs').readFileSync('./outfile.js').toString();
    var vm = require('vm');
    vm.runInThisContext(code, {filename: 'outfile.js'});

    // console.log('before import sys', System);
    return System.import('object-assign.js').then(function(exports) {
        // console.log('after import', System);
        console.log('exports', exports);
    }).catch(function(e) {
        console.log('error', e.stack);
    });
}
