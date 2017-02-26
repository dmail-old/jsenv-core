import {transpile} from '/helper/detect.js';
import {test as objectAssignTest} from '/object/assign/feature.js';
const test = {
    dependencies: [objectAssignTest],
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

import {solution as objectAssignSolution} from '/object/assign/feature.js';
const solution = {
    dependencies: [objectAssignSolution],
    type: 'babel',
    value: 'transform-es2015-spread'
};
export {solution};
