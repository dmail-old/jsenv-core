var parse = require('./parse.js');
var removeWhen = require('./remove-when.js');

var mapAsync = require('../api/util/map-async.js');
var createTranspiler = require('../api/util/transpiler.js');
var collectDependencies = require('./collect-dependencies.js');
var makImportedExport = require('./mark-imported-export.js');

function transform(entryRelativeHref, absoluteRootHref, options) {
    return parse(entryRelativeHref, absoluteRootHref, options).then(function(tree) {
        var root = tree.root;
        makImportedExport(root);

        return removeWhen(root, options.exclude).then(function(removedNodes) {
            removedNodes = removedNodes.concat(collectDependencies.apply(null, removedNodes));

            function pathIsRemoved(path) {
                return removedNodes.some(function(removedNode) {
                    return removedNode.path === path;
                });
            }

            var transpiler = createTranspiler({
                cache: false,
                sourceMaps: true
            });
            transpiler.options.plugins = [
                createTranspiler.removeImport(function(importee, importer) {
                    var importPath = tree.locate(importee, importer);
                    var importIsRemoved = pathIsRemoved(importPath);
                    if (importIsRemoved) {
                        console.log(importee, 'import removed from', importer);
                    }
                    return importIsRemoved;
                }),
                'babel-plugin-transform-es2015-modules-systemjs'
            ];

            var nodes = [root].concat(collectDependencies(root));
            return mapAsync(nodes, function(node) {
                return tree.fetch(node).then(function(source) {
                    // node.originalSource = source;
                    return transpiler.transpile(source, {
                        moduleId: node.id,
                        filename: node.path
                    });
                }).then(function(result) {
                    node.source = result.code;
                    // node.sourceMap = result.map;
                    // node.ast = result.ast;
                });
            }).then(function() {
                return nodes;
            });
        });
    });
}
module.exports = transform;

transform(
    'src/trace/fixtures/conditional/entry.js',
    null,
    {
        exclude: function(node) {
            return node.id === 'src/trace/fixtures/conditional/file.js';
        }
    }
).then(function(result) {
    console.log('result', result);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});
