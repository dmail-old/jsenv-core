import {expect, presence} from '/test-helpers.js';

const test = expect({
    'presence': presence('Date', 'now')
});

export default test;
