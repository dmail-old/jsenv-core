var Builder = require('systemjs-builder');
var builder = new Builder('');

// builder.config({
//   transpiler: false,
//   'meta': {
//     '*': {format: 'system'}
//   }
// });
builder.bundle('module.js', 'outfile.js', {
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
