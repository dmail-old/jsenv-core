import {at, present} from '/test-helpers.js';

const test = {
    run: at('String', 'prototype', 'endsWith'),
    complete: present
};

export default test;
