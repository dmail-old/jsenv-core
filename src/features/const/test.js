import {transpile} from '/detect-helpers.js';

const test = {
    run: transpile`(function(value) {
        const result = value;
        return result;
    })`,
    complete(fn) {
        var value = 1;
        var result = fn(value);
        return result === value;
    }
};

export default test;
