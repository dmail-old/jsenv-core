import {expect, presence} from '/test-helpers.js';

const test = expect({
    'presence': presence('String', 'prototype', 'at')
});

export default test;
