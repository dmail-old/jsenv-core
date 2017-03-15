var Builder = require('systemjs-builder');
var builder = new Builder('');

// https://github.com/systemjs/builder/blob/f988373a164c9a5c868afc1e57664706d6f2ab79/lib/builder.js#L409
// https://github.com/systemjs/builder/blob/master/test/fixtures/conditional-tree/custom-conditions.js
// https://github.com/systemjs/builder/blob/master/test/conditional-builds.js#L71

builder.config({
    meta: {
        '*': {
            format: 'system'
        }
    }
});
builder.bundle('module.js', 'outfile.js', {
    sourceMaps: true
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
