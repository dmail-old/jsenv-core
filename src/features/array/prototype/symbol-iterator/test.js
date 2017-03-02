import '/symbol/iterator/fix.js';
import {at, present} from '/tets-helpers.js';

const test = {
    run: at('Array', 'prototype', at('Symbol', 'iterator')),
    test: present
};

export default test;
