import '/symbol/iterator/fix.js';
import {at, present, every, sameValues} from '/tets-helpers.js';

const test = {
    run: at('Array', 'prototype', at('Symbol', 'iterator')),
    test: every(
        present,
        function() {
            var arrayIterator = Array.prototype[Symbol.iterator];
            var sparseArray = [,,]; // eslint-disable-line no-sparse-arrays, comma-spacing
            var iterator = arrayIterator.call(sparseArray);

            return sameValues(iterator, sparseArray);
        }
    )
};

export default test;
