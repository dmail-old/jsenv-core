var fs = require('fs');

require('core-js-builder')({
    modules: ['es6.object.assign'],
    library: false,
    umd: true
}).then(function(code) {
    fs.writeFileSync('polyfill-all.js', code);
}).catch(function(error) {
    throw error;
});
