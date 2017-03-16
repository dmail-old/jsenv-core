import {expect, presence} from '/test-helpers.js';

const test = expect({
    'presence': presence('performance', 'now')
});

export default test;
