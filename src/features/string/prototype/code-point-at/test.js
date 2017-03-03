import {at, present} from 'helper/detect.js';

const test = {
    run: at('String', 'prototype', 'codePointAt'),
    complete: present
};

export default test;
