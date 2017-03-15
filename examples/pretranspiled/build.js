var Builder = require('systemjs-builder');
var builder = new Builder('');

// https://github.com/systemjs/builder/blob/046b29880700b680bb46c62f442f3c46c33f93aa/compilers/compiler.js

builder.config({
    transpiler: false // ou alors je passe mon transpiler
    // 'meta': {
    //     '*': {format: 'system'}
    // }
});
builder.bundle('module.js', 'outfile.js', {
    fetch: function(load, fetch) {
        // on peut faire load.metaData.sourceMap = la sourcemap qu'on récup du cache
        // ou alors on laisse le builder récup le sourcemap
        // ptet qu'il y arrive tout seul
        return fetch(load);
    }
    // globalName: 'NavBar',
    // format: 'amd'
    // rollup: true,
    // minify: false
}).then(function() {
    console.log('Build complete');
}).catch(function(err) {
    console.log('Build error');
    console.log(err.stack);
});
