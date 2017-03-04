import {transpile, sameValues, expectThrow, every, createIterableObject} from '/test-helpers.js';
import '/symbol/iterator/test.js';
import '/array/prototype/symbol-iterator.js';
import '/string/prototype/symbol-iterator.js';
import '/object/create/test.js';

const test = {
    run: transpile`(function(value) {
        const result = value;
        return result;
    })`,
    complete(fn) {
        var value = 1;
        var result = fn(value);
        return result === value;
    },

    children: [
        {
            name: 'array-notation',
            run: transpile`(function(value) {
                return [...value];
            })`,
            complete: every(
                function(fn) {
                    var value = [1, 2, 3];
                    var result = fn(value);
                    return sameValues(result, value);
                },
                function() {
                    // must test non iterable
                },
                function() {
                    // must test on iterable instance
                }
            )
        },
        {
            name: 'function-notation',
            run: transpile`(function(method, args) {
                return method(...args);
            })`,
            complete: every(
                function(fn) {
                    var method = Math.max;
                    var args = [1, 2, 3];
                    var result = fn(method, args);

                    return result === method.apply(null, args);
                },
                function(fn) {
                    var method = Math.max;
                    var data = [1, 2, 3];
                    var iterable = createIterableObject(data);
                    var result = fn(method, iterable);

                    return result === method.apply(null, data);
                },
                function(fn) {
                    var method = Math.max;
                    var data = [1, 2, 3];
                    var iterable = createIterableObject(data);
                    var instance = Object.create(iterable);
                    var result = fn(instance);
                    return result === method.apply(null, data);
                },
                // must throw on non-iterable
                expectThrow(function(fn) {
                    fn(Math.max, true);
                    // because boolean are not iterable
                    // but in case on day Boolean.prototype[Symbol.iterator] exists
                    // the true "perfect" test would delete[Symbol.iterator] from object if it exists
                })
            )
        }
    ]
};

export default test;
