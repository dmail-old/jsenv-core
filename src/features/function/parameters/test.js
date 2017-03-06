import '/block-scoping/test.js';
import '/destructuring/test.js';

import {expect, transpile, sameValues} from '/test-helpers.js';

const test = expect({
    'default': expect({
        'compiles': transpile`(function(defaultA, defaultB) {
            return function(a = defaultA, b = defaultB) {
                return [a, b];
            };
        })`,
        'runs'(fn) {
            var defaultA = 1;
            var defaultB = 2;
            var a = 3;
            var result = fn(defaultA, defaultB)(a);
            return sameValues(result, [a, defaultB]);
        },
        'works with explicit undefined'(fn) {
            var defaultA = 1;
            var defaultB = 2;
            var a;
            var b = 4;
            var result = fn(defaultA, defaultB)(a, b);
            return sameValues(result, [defaultA, b]);
        },
        'does not mutate arguments': expect({
            'compiles': transpile`(function(defaultValue) {
                return function(a = defaultValue) {
                    a = 10;
                    return arguments;
                };
            })`,
            'runs'(fn) {
                var defaultValue = 1;
                var value = 2;
                var result = fn(defaultValue)(value);
                return sameValues(result, [value]);
            }
        }),
        'can refer previous argument': expect({
            'compiles': transpile`(function(defaultValue) {
                return function(a = defaultValue, b = a) {
                    return [a, b];
                };
            })`,
            'runs'(fn) {
                var defaultValue = 1;
                var result = fn(defaultValue)();
                return sameValues(result, [defaultValue, defaultValue]);
            }
        })
    }),
    'rest': expect({
        'compiles': transpile`(function(foo, ...rest) {
            return [foo, rest];
        })`,
        'runs'(fn) {
            var first = 1;
            var second = 2;
            var result = fn(first, second);
            return (
                result[0] === first &&
                sameValues(result[1], [second])
            );
        },
        'does not count in function length': expect({
            'compiles': transpile`(function() {
                return [
                    function(a, ...b) {},
                    function(...c) {}
                ];
            })`,
            'runs'(fn) {
                var result = fn();

                return (
                    result[0].length === 1 &&
                    result[1].length === 0
                );
            }
        })
    }),
    'destructuring': expect({
        'array-notation': expect({
            'compiles': transpile`(function([a]) {
                return a;
            })`,
            'runs'(fn) {
                var value = 1;
                var result = fn([value]);
                return result === value;
            },
            'length'(fn) {
                return fn.length === 1;
            }
        }),
        'object-notation': expect({
            'compiles': transpile`(function({a}) {
                return a;
            })`,
            'runs'(fn) {
                var value = 1;
                var result = fn({a: value});
                return result === value;
            },
            'length'(fn) {
                return fn.length === 1;
            }
        })
    })
});

export default test;
