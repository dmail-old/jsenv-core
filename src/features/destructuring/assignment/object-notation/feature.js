import {transpile, expect} from 'helper/detect.js';
import parent from '//destructuring/feature.js';

const feature = {
    run: transpile`(function(value) {
        ({a} = {a: value});
        return a;
    })`,
    test: expect(function(fn) {
        var value = 1;
        var result = fn(value);
        return result === value;
    }),
    solution: parent.solution
};

export default feature;
