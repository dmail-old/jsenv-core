import {transpile, expect} from 'helper/detect.js';
import parent from '../feature.js';

const feature = {
    dependencies: [parent],
    run: transpile`(function(value) {
        var result;
        function fn() {
            result = foo;
        }
        const foo = value;
        fn();
        return result;
    })`,
    test: expect(function(fn) {
        var value = 10;
        var result = fn(value);
        return result === value;
    }),
    solution: parent.solution
};

export default feature;
