const name = 'const';
export {name};

import {transpile} from 'helper/detect.js';
const test = {
    name: name,
    run: transpile`(function(value) {
        const result = value;
        return result;
    })`,
    complete: function(fn) {
        var value = 1;
        var result = fn(value);
        return result === value;
    }
};
export {test};

const solution = {
    type: 'babel',
    value: 'transform-es2015-block-scoping'
};
export {solution};
