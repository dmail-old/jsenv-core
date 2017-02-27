import {transpile, expectThrow} from 'helper/detect.js';
import {test as constTest} from '../feature.js';
const test = {
    dependencies: [constTest],
    run: transpile`(function() {
        if (true) const bar = 1;
    })`,
    complete: expectThrow(
        function(fn) {
            fn();
        },
        {name: 'SyntaxError'}
    )
};
export {test};

const solution = {
    type: 'none'
};
export {solution};
