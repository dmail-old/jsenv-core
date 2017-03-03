import {at, present} from '/test-helpers.js';

const test = {
    run: at('String', 'prototype', 'escapeHTML'),
    complete: present
};

export default test;
