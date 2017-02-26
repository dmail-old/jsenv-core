const name = 'const/scoped';
export {name};

import {transpile} from 'helper/detect.js';
import {test as constTest} from '../feature.js';
const test = {
    name: name,
    dependencies: [constTest],
    run: transpile`(function(outsideValue, insideValue) {
        const a = outsideValue;
        {
            const a = insideValue;
        }
        return a;
    })`,
    complete: function(fn) {
        var outsideValue = 0;
        var insideValue = 1;
        var returnValue = fn(outsideValue, insideValue);
        return returnValue === outsideValue;
    }
};
export {test};

export {solution} from '../feature.js';
