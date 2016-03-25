require('../index.js');

var engine = global.engine;

engine.run(function testingError() {
    return System.import(engine.locate('./test/modules/error.js')).then(function(module) {
        module.default();
    }).catch(function(error) {
        // var stack = error.stack;
        // assert.equal(error.lineNumber, 3);
        // console.log('got an error', error);

        return Promise.reject(error);
    });
});
