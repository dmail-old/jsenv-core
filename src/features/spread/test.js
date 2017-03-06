import '/array/from/test.js';
import '/array/prototype/symbol/iterator/test.js';
import '/object/create/test.js';

import {expect, transpile, createIterableObject, sameValues} from '/test-helpers.js';

const test = expect({
    'array-notation': expect({
        'compiles': transpile`(function(value) {
            return [...value];
        })`,
        'runs'(fn) {
            var value = [1, 2, 3];
            var result = fn(value);
            return sameValues(result, value);
        },
        'works with iterable'(fn) {
            var data = [1, 2, 3];
            var iterable = createIterableObject(data);
            var result = fn(iterable);
            var resultWithInstance = fn(Object.create(iterable));
            return (
                sameValues(result, data) &&
                sameValues(resultWithInstance, data)
            );
        }
    }),
    'function-notation': expect({
        'compiles': transpile`(function(method, args) {
            return method(...args);
        })`,
        'runs'(fn) {
            var method = Math.max;
            var args = [1, 2, 3];
            var result = fn(method, args);

            return result === method.apply(null, args);
        },
        'works with iterable'(fn) {
            var method = Math.max;
            var data = [1, 2, 3];
            var iterable = createIterableObject(data);
            var result = fn(method, iterable);
            var resultWithInstance = fn(method, Object.create(iterable));

            return (
                result === method.apply(null, data) &&
                resultWithInstance === method.apply(null, data)
            );
        }
        // apparently babel does not throw on non-iterable value
        // 'throw with non iterable': expectThrow(fn => {
        //     fn(Math.max, true);
        //     // because boolean are not iterable
        //     // but in case on day Boolean.prototype[Symbol.iterator] exists
        //     // the true "perfect" test would delete[Symbol.iterator] from object if it exists
        // })
    })
});

export default test;
