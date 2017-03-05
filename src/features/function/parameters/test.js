import {transpile, every, sameValues} from '/test-helpers.js';

const test = {
    children: [
        {
            name: 'default',
            run: transpile`(function(defaultA, defaultB) {
                return function(a = defaultA, b = defaultB) {
                    return [a, b];
                };
            })`,
            complete: every(
                function(fn) {
                    var defaultA = 1;
                    var defaultB = 2;
                    var a = 3;
                    var result = fn(defaultA, defaultB)(a);
                    return sameValues(result, [a, defaultB]);
                },
                function(fn) {
                    var defaultA = 1;
                    var defaultB = 2;
                    var a;
                    var b = 4;
                    var result = fn(defaultA, defaultB)(a, b);
                    return sameValues(result, [defaultA, b]);
                }
            ),
            children: [
                {
                    name: 'arguments',
                    run: transpile`(function(defaultValue) {
                        return function(a = defaultValue) {
                            a = 10;
                            return arguments;
                        };
                    })`,
                    complete(fn) {
                        var defaultValue = 1;
                        var value = 2;
                        var result = fn(defaultValue)(value);
                        return sameValues(result, [value]);
                    }
                },
                {
                    name: 'refer-previous',
                    run: transpile`(function(defaultValue) {
                        return function(a = defaultValue, b = a) {
                            return [a, b];
                        };
                    })`,
                    complete(fn) {
                        var defaultValue = 1;
                        var result = fn(defaultValue)();
                        return sameValues(result, [defaultValue, defaultValue]);
                    }
                }
            ]
        },
        {
            name: 'rest',
            run: transpile`(function(foo, ...rest) {
                return [foo, rest];
            })`,
            complete(fn) {
                var first = 1;
                var second = 2;
                var result = fn(first, second);
                return (
                    result[0] === first &&
                    sameValues(result[1], [second])
                );
            },
            children: [
                {
                    name: 'length',
                    run: transpile`(function() {
                        return [
                            function(a, ...b) {},
                            function(...c) {}
                        ];
                    })`,
                    complete(fn) {
                        var result = fn();

                        return (
                            result[0].length === 1 &&
                            result[1].length === 0
                        );
                    }
                }
            ]
        }
    ]
};

export default test;
