import {expect, presence} from '/test-helpers.js';

const test = expect({
    'presence': presence('Object', 'getPrototypeOf')
});

export default test;
