import '/object/keys/test.js';
import '/symbol/test.js';

import {expect, presence, sameValues, collectKeys} from '/test-helpers.js';

const test = expect({
    'presence': presence('Object', 'assign'),
    'deterministic order'(assign) {
        const keys = 'abcdefghijklmnopqrst'.split('');
        const object = {};
        keys.forEach(function(key) {
            object[key] = key;
        });
        const result = assign({}, object);
        return sameValues(collectKeys(result), keys);
    },
    'works with symbol'(assign) {
        const object = {};
        const symbol = Symbol();
        const value = 1;
        object[symbol] = value;
        const result = assign({}, object);
        return result[symbol] === value;
    }
});

export default test;
