import {transpile, expect} from 'helper/detect.js';

const feature = {
    run: transpile`(function(name, value) {
        return {[name]: value};
    })`,
    test: expect(function(fn) {
        var name = 'y';
        var value = 1;
        var result = fn(name, value);
        return result[name] === value;
    }),
    solution: {
        type: 'babel',
        name: 'transform-es2015-computed-properties'
    }
};

export default feature;
