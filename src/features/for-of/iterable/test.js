import '/iterable-behaviour.js';
import {createIterableObject, sameValues} from '/test-helpers.js';
import forOfTest from '../test.js';

const test = {
    run: forOfTest.run,
    complete(fn) {
        var data = [1, 2, 3];
        var iterable = createIterableObject(data);
        var result = fn(iterable);
        return sameValues(result, data);
    }
};

export default test;
