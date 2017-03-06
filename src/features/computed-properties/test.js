import {expect, transpile} from '/test-helpers.js';

const test = expect({
    'compiles': transpile`(function(name, value) {
        return {[name]: value};
    })`,
    'runs'(fn) {
        var name = 'y';
        var value = 1;
        var result = fn(name, value);
        return result[name] === value;
    }
});

export default test;
