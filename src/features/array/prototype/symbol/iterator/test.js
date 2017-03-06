import '/symbol/iterator/test.js';

import {expect, presence, at, sameValues} from '/test-helpers.js';

const test = expect({
    'presence': presence('Array', 'prototype', at('Symbol', 'iterator')),
    'works with sparse'(arrayIterator) {
        const sparseArray = [,,]; // eslint-disable-line no-sparse-arrays, comma-spacing
        const iterator = arrayIterator.call(sparseArray);
        return sameValues(iterator, sparseArray);
    }
});

export default test;
