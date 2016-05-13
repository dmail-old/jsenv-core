require('../index.js');

global.setup().then(function(jsenv) {
    return jsenv.importMain('./modules/module-error.js');
}).then(function(mainModule) {
    mainModule.default();
});

// var stack = error.stack;
// assert.equal(error.lineNumber, 3);
// console.log('got an error', error);
