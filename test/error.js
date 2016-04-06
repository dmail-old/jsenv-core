require('../index.js');

var engine = global.engine;

engine.start('./test/modules/module-error.js').then(function(mainModule) {
    mainModule.default();
}).catch(function(error) {
    // we have to catch because node promise do not support unhandledRejection
    engine.exceptionHandler.handleError(error);
});

// var stack = error.stack;
// assert.equal(error.lineNumber, 3);
// console.log('got an error', error);
