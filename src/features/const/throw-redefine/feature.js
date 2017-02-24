import {transpile, expect, expectThrow} from 'helper/detect.js';
import parent from '../feature.js';

const feature = {
    dependencies: [parent],
    run: transpile`(function() {
        const foo = 1;
        foo = 2;
    })`,
    test: expect(expectThrow(function(fn) {
        fn();
    })),
    solution: {
        type: 'none'
    }
};

export default feature;
