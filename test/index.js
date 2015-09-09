import assert from 'node/assert';

System.import('./test/modules/a.js').then(function(exports){
	assert.equal(exports.default, 'a');
});

System.import('node/http').then(function(exports){
	assert.equal(typeof exports.default.createServer, 'function');
});

// ensure functionalities are present
assert('Promise' in global);
assert('assign' in Object);
assert('URLSearchParams' in global);
assert('URL' in global);
assert('Symbol' in global);
assert('setImmediate' in global);