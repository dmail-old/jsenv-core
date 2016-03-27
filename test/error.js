require('../index.js');

var engine = global.engine;

engine.run(function testError() {
    return engine.main(engine.locate('./test/modules/error.js')).then(function(module) {
        return module.default;
    });
});

// var stack = error.stack;
// assert.equal(error.lineNumber, 3);
// console.log('got an error', error);
