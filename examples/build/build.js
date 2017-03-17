/*
- vérifier que la prétranspilation fonctionne nickel avec le build sur tree

- pour que ça marche les fichier fix.js devront s'éxécuter tout seul ou en tous cas kk chose dans ce gout là
et les plugins babel ne devront plus être ajouté en éxécutant fix.js pour lire que c'est un plugin babel
on se contente d'avoir une liste de plugin définie au départ pas l choix

- pouvoir exclure des noeuds pour éviter qu'il se retrouve dans le build ou alors les conserver
mais les rediriger vers '@empty'en faisant depMap: {'a.js': '@empty', './b.js': '@empty'} + delete tree['a.js']
*/

// var path = require('path');
var Builder = require('systemjs-builder');
var builder = new Builder('./');
builder.config({
    baseURL: process.cwd()
});

// var createTranspiler = require('../../src/api/util/transpiler.js');
// var transpiler = createTranspiler({
//     cache: false,
//     sourceMaps: true,
//     plugins: [
//         'babel-plugin-transform-es2015-modules-systemjs'
//     ]
// });
// function transpile(source, filename, moduleId) {
//     return transpiler.transpile(source, {
//         filename: filename,
//         moduleId: moduleId
//     });
// }

// var mapAsync;
// function transpileTree(tree) {
//     return mapAsync(Object.keys(tree), function(name) {
//         var node = tree[name];
//         return transpile(node.source, node.path, node.name).then(function(result) {
//             node.source = result.code;

//             node.metadata.format = 'system';
//             node.metadata.sourceMap = result.map;
//             if (result.ast) {
//                 node.metadata.ast = result.ast;
//             }
//         });
//     });
// }

builder.trace('object-assign.js').then(function(tree) {
    console.log('tree from the module', tree);
    return builder.bundle(tree);
}).catch(function(err) {
    console.log('trace error');
    console.log(err);
});

// builder.bundle('object-assign.js', 'outfile.js', {
//     fetch: function(load, fetch) {
//         return Promise.resolve(fetch(load)).then(function(source) {
//             return Promise.resolve(transpile(source, load.address, load.name)).then(function(result) {
//                 load.metadata.sourceMap = result.map;
//                 return result.code;
//             });
//         });
//     },
//     sourceMaps: true,
//     sourceMapContents: true
// }).then(function() {
//     console.log('Build complete');
// }).catch(function(err) {
//     console.log('Build error');
//     console.log(err);
// });
