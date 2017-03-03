import '/symbol/iterator/test.js';
import {at, present, every, sameValues} from '/test-helpers.js';

const test = {
    run: at('String', 'prototype', at('Symbol', 'iterator')),
    complete: every(
        present,
        function() {
            const stringIterator = String.prototype[Symbol.iterator];
            const normalString = '1234';
            const iterator = stringIterator.call(normalString);
            return sameValues(iterator, normalString);
        },
        function() {
            const stringIterator = String.prototype[Symbol.iterator];
            const astralString = '𠮷𠮶';
            const iterator = stringIterator.call(astralString);
            return sameValues(iterator, astralString);
        }
    )
};

export default test;
