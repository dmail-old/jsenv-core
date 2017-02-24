import {transpile, expect} from 'helper/detect.js';

const feature = {
    run: transpile`(function(value) {
        const result = value;
        return result;
    })`,
    test: expect(function(fn) {
        var value = 1;
        return fn(value) === value;
    }),
    solution: {
        type: 'babel',
        value: 'transform-es2015-block-scoping'
    }
};

export default feature;
