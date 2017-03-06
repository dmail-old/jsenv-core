import {expect, presence} from '/test-helpers.js';

const test = expect({
    'presence': presence('Object', 'isFrozen')
});

export default test;
