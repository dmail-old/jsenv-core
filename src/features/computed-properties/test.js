import {transpile} from 'helper/detect.js';

const test = {
    run: transpile`(function(name, value) {
        return {[name]: value};
    })`,
    complete(fn) {
        var name = 'y';
        var value = 1;
        var result = fn(name, value);
        return result[name] === value;
    }
};

export default test;
