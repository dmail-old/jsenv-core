import '/array/prototype/symbol/iterator/test.js';
import '/object/create/test.js';

import {expect, transpile, sameValues, createIterableObject} from '/test-helpers.js';

const test = expect({
    'compiles': transpile`(function(value) {
        var result = [];
        for (var entry of value) {
            result.push(entry);
        }
        return result;
    })`,
    'works with array'(fn) {
        var value = [5];
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
    },
    'iterable return method called on break': expect({
        'compiles': transpile`(function(value) {
            for (var it of value) {
                break;
            }
        })`,
        'runs'(fn) {
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
    }),
    'iterable return method called on throw': expect({
        'compiles': transpile`(function(value, throwedValue) {
            for (var it of value) {
                throw throwedValue;
            }
        })`,
        'runs'(fn) {
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
    })
});

export default test;
