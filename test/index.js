import assert from 'node/assert';
import childProcess from 'node/child_process';

import a from './modules/a.js';
import http from 'node/http';
import proto from 'proto';

assert.equal(a, 'a');
assert.equal(typeof http.createServer, 'function');
// ensure functionalities are present
assert('Promise' in global);
assert('assign' in Object);
assert('URLSearchParams' in global);
assert('URL' in global);
assert('Symbol' in global);
assert('setImmediate' in global);

assert(typeof require('assert'), 'function');
assert(typeof proto, 'object');

console.log('all tests passed');