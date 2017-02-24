import {transpile, expect} from 'helper/detect.js';
import parent from '../feature.js';

const feature = {
    dependencies: [parent],
    run: transpile`(function(outsideValue, insideValue) {
        const a = outsideValue;
        {
            const a = insideValue;
        }
        return a;
    })`,
    test: expect(function(fn) {
        var outsideValue = 0;
        var insideValue = 1;
        var returnValue = fn(outsideValue, insideValue);
        return returnValue === outsideValue;
    }),
    solution: parent.solution
};

export default feature;
