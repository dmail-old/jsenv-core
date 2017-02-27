import {transpile, expectThrow} from '//helper/detect.js';
import {test as constTest} from '../feature.js';
const test = {
    dependencies: [constTest],
    run: transpile`(function() {
        const foo = 1;
        foo = 2;
    })`,
    complete: expectThrow(function(fn) {
        fn();
    })
};
export {test};

const solution = {
    type: 'none'
};
export {solution};
