import {at, present} from '/test-helpers.js';

const test = {
    run: at('String', 'prototype', 'at'),
    test: present
};

export default test;
