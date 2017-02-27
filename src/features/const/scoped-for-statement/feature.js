import {transpile} from '/helper/detect.js';
import {test as constTest} from '../feature.js';

const test = {
    dependencies: [constTest],
    run: transpile`(function(outsideValue, insideValue) {
        const foo = outsideValue;
        for(const foo = insideValue; false;) {}
        return foo;
    })`,
    complete(fn) {
        var outsideValue = 0;
        var insideValue = 1;
        var result = fn(outsideValue, insideValue);
        return result === outsideValue;
    }
};
export {test};

export {solution} from '../feature.js';
