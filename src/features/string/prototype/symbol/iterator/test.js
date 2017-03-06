import '/symbol/iterator/test.js';

import {expect, presence, at, sameValues} from '/test-helpers.js';

const test = expect({
    'presence': presence('String', 'prototype', at('Symbol', 'iterator')),
    'runs'(stringIterator) {
        const normalString = '1234';
        const iterator = stringIterator.call(normalString);
        return sameValues(iterator, normalString);
    },
    'works with astral'(stringIterator) {
        const astralString = '𠮷𠮶';
        const iterator = stringIterator.call(astralString);
        return sameValues(iterator, astralString);
    }
});

export default test;
