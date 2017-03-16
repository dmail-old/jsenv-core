// var path = require('path');

var mapAsync = require('./map-async.js');
var buildAbstractSource = require('./build-abstract-source.js');
var trace = require('./trace.js');
var collectDependencies = require('./collect-dependencies.js');
// var uneval = require('./uneval.js');

function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
function build(abstractObjects, options) {
    // ajouter systemjs aux abstractobjects ?
    // abstractObjects.unshift({

    // });
    options = options || {};
    var root = normalizePath(options.root || process.cwd());
    var transpiler = options.transpiler;
    var minify = options.minify || false;

    var mainSource = buildAbstractSource(abstractObjects, minify);
    var mainName = 'main.js';
    var mainId = root + '/' + mainName;
    var traceOptions = {
        fetch: function(node, fetch) {
            if (node.id === mainId) {
                return mainSource;
            }
            return fetch(node.id);
        }
    };

    return trace([mainName], traceOptions).then(function(nodes) {
        var allNodes = nodes.concat(collectDependencies(nodes));

        return mapAsync(allNodes, function(node) {
            if (transpiler) {
                return Promise.resolve(transpiler.transpile(node.source, {
                    filename: node.id,
                    moduleId: node.name,
                    sourceRoot: root
                })).then(function(result) {
                    node.source = result.code;
                    node.map = result.map;
                    // node.ast = result.ast.program;
                });
            }
        }).then(function() {
            return allNodes.map(function(node) {
                return node.source;
            }).join('\n\n');
        });
    });
}

module.exports = build;

var createTranspiler = require('./transpiler.js');
var transpiler = createTranspiler({
    cache: false,
    // sourceMaps: true,
    plugins: [
        'babel-plugin-transform-es2015-modules-systemjs'
    ]
});
var abstractObjects = [
    {
        foo: {
            type: 'import',
            name: 'default',
            from: './foo.js'
        }
    }
];
build(abstractObjects, {
    transpiler: transpiler
}).then(function(data) {
    console.log('build complete', data);
}).catch(function(error) {
    console.log('build error', error.stack);
});
