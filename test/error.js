require('../index.js');

var engine = global.engine;

engine.start('./test/modules/error.js');

// var stack = error.stack;
// assert.equal(error.lineNumber, 3);
// console.log('got an error', error);
