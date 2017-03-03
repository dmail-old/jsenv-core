import '/array/prototype/symbol-iterator/test.js';
import '/string/prototype/symbol-iterator/test.js';
import '/object/create/test.js';
import {transpile, sameValues, createIterableObject, every} from '/test-helpers.js';

const test = {
    run: transpile`(function(value) {
        var result = [];
        for (var entry of value) {
            result.push(entry);
        }
        return result;
    })`,
    complete: every(
        function(fn) {
            var value = [5];
            var result = fn(value);
            return sameValues(result, value);
        },
        function(fn) {
            var data = [1, 2, 3];
            var iterable = createIterableObject(data);
            var result = fn(iterable);
            return sameValues(result, data);
        },
        function(fn) {
            var data = [1, 2, 3];
            var iterable = createIterableObject(data);
            var instance = Object.create(iterable);
            var result = fn(instance);
            return sameValues(result, data);
        }
    ),
    children: [
        {
            name: 'return-called-on-break',
            run: transpile`(function(value) {
                for (var it of value) {
                    break;
                }
            })`,
            pass: function(fn) {
                var called = false;
                var iterable = createIterableObject([1], {
                    'return': function() {
                        called = true;
                        return {};
                    }
                });
                fn(iterable);
                return called;
            }
        },
        {
            name: 'return-called-on-throw',
            run: transpile`(function(value, throwedValue) {
                for (var it of value) {
                    throw throwedValue;
                }
            })`,
            pass: function(fn) {
                var called = false;
                var iterable = createIterableObject([1], {
                    'return': function() { // eslint-disable-line
                        called = true;
                        return {};
                    }
                });
                var throwedValue = 0;

                try {
                    fn(iterable, throwedValue);
                } catch (e) {
                    return (
                        e === throwedValue &&
                        called
                    );
                }
                return false;
            }
        }
    ]
};

export default test;
