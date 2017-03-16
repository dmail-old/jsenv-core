// https://github.com/systemjs/builder/blob/f988373a164c9a5c868afc1e57664706d6f2ab79/lib/builder.js#L409
// https://github.com/systemjs/builder/blob/master/test/fixtures/conditional-tree/custom-conditions.js
// https://github.com/systemjs/builder/blob/master/test/conditional-builds.js#L71

// je pense qu'il faut forker systemjs builder en gros
// et ptet utiliser '@empty' ou le empty module pour les imports dont on a finalement pas besoin
// et en gros dans ce fork on est aussi capable de connaitre les dépendances
// ce qui aura un intérêt

// est-ce que ça ne peut pas suffir ->
// un premier build qui ignore les import
// http://stackoverflow.com/questions/37403990/how-to-tell-systemjs-to-ignore-an-import
// https://github.com/systemjs/builder/issues/434

// l'idée serais très simple en fait
// on dit aux builder d'ignore une partie des import qu'on redirige vers @empty
// et on fait ça lisant en premier les dépendances et en regardant le status comme on le faisait avant
// plus simple tu meurs
// reste le souci du cache du builder + sourcemap que le builder ne supporte pas vraiment
// ni la transpilation dynamique.
// c'est là qu'intervient fetch

// var path = require('path');
var Builder = require('systemjs-builder');
var builder = new Builder('');

builder.config({
    // map: {
    //     './a.js': '@empty'
    // },
    transpiler: false
    // 'meta': {
    //     '*': {format: 'system'}
    // }
});

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

builder.bundle('module.js', 'outfile.js', {
    fetch: function(load, fetch) {
        return Promise.resolve(fetch(load)).then(function(source) {
            return Promise.resolve(transpile(source, load.address, load.name)).then(function(result) {
                load.metadata.sourceMap = result.map;
                return result.code;
            });
        });
    },
    sourceMaps: true,
    sourceMapContents: true
    // globalName: 'NavBar',
    // format: 'amd'
    // rollup: true,
    // minify: false
}).then(function() {
    console.log('Build complete');
}).catch(function(err) {
    console.log('Build error');
    console.log(err);
});
