import '/array/prototype/symbol-iterator/test.js';
import {transpile, sameValues} from '/test-helpers.js';

const test = {
    run: transpile`(function(value) {
        var result = [];
        for (var entry of value) {
            result.push(entry);
        }
        return result;
    })`,
    complete(fn) {
        var value = [5];
        var result = fn(value);
        return sameValues(result, value);
    }
};

export default test;
