import {transpile} from '/helper/detect.js';
import {test as consTest} from '../feature.js';

const test = {
    dependencies: [consTest],
    run: transpile`(function(value) {
        var result;
        function fn() {
            result = foo;
        }
        const foo = value;
        fn();
        return result;
    })`,
    complete(fn) {
        var value = 10;
        var result = fn(value);
        return result === value;
    }
};
export {test};

export {solution} from '../feature.js';
