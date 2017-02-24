import {transpile, expect, expectThrow} from 'helper/detect.js';
import parent from '../feature.js';

const feature = {
    dependencies: [parent],
    run: transpile`(function() {
        if (true) const bar = 1;
    })`,
    test: expect(
        expectThrow(
            function(fn) {
                fn();
            },
            {name: 'SyntaxError'}
        )
    ),
    solution: {
        type: 'none'
    }
};

export default feature;
