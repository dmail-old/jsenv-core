import {transpile, expect} from 'helper/detect.js';
import parent from '../feature.js';

const feature = {
    dependencies: [parent],
    run: transpile`(function(outsideValue, insideValue) {
        const foo = outsideValue;
        for(const foo = insideValue; false;) {}
        return foo;
    })`,
    test: expect(function(fn) {
        var outsideValue = 0;
        var insideValue = 1;
        var result = fn(outsideValue, insideValue);
        return result === outsideValue;
    }),
    solution: parent.solution
};

export default feature;
