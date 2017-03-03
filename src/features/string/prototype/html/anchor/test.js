import {at, present, every} from '/test-helpers.js';
import {expectLowerCaseAndAttribute} from '../helpers.js';

const test = {
    run: at('String', 'prototype', 'anchor'),
    complete: every(
        present,
        function(_, pass, fail) {
            return expectLowerCaseAndAttribute(String.prototype.anchor, pass, fail);
        }
    )
};

export default test;
