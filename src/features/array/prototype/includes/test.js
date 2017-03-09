import {expect, presence} from '/test-helpers.js';

const test = expect({
    'presence': presence('Array', 'prototype', 'includes')
});

export default test;
