import assert from 'node/assert';
import childProcess from 'node/child_process';

import a from './test/modules/a.js';
import http from 'node/http';

assert.equal(a, 'a');
assert.equal(typeof http.createServer, 'function');
// ensure functionalities are present
assert('Promise' in global);
assert('assign' in Object);
assert('URLSearchParams' in global);
assert('URL' in global);
assert('Symbol' in global);
assert('setImmediate' in global);