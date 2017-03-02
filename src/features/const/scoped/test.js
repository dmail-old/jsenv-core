import {transpile} from '/test-helpers.js';

const test = {
    run: transpile`(function(outsideValue, insideValue) {
        const a = outsideValue;
        {
            const a = insideValue;
        }
        return a;
    })`,
    complete(fn) {
        var outsideValue = 0;
        var insideValue = 1;
        var returnValue = fn(outsideValue, insideValue);
        return returnValue === outsideValue;
    }
};

export default test;
