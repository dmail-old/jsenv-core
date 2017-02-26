import {transpile, expect, sameValues} from 'helper/detect.js';
import parent from '//destructuring/feature.js';

const feature = {
    run: transpile`(function(a, b) {
        [b, a] = [a, b];
        return [a, b];
    })`,
    test: expect(function(fn) {
        var a = 1;
        var b = 2;
        var result = fn(a, b);
        return sameValues(result, [b, a]);
    }),
    solution: parent.solution
};

export default feature;
