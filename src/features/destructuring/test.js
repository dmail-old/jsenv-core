import {transpile, sameValues} from '/test-helpers.js';

const test = {
    children: [
        {
            name: 'assignment',
            children: [
                {
                    name: 'array-notation',
                    run: transpile`(function(a, b) {
                        [b, a] = [a, b];
                        return [a, b];
                    })`,
                    complete(fn) {
                        var a = 1;
                        var b = 2;
                        var result = fn(a, b);
                        return sameValues(result, [b, a]);
                    },
                    children: [
                        {
                            name: 'chain',
                            run: transpile`(function(value) {
                                var a, b;
                                ([a] = [b] = [value]);
                                return [a, b];
                            })`,
                            complete(fn) {
                                var value = 1;
                                var result = fn(value);
                                return sameValues(result, [value, value]);
                            }
                        }
                    ]
                },
                {
                    name: 'object-notation',
                    run: transpile`(function(value) {
                        ({a} = {a: value});
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn(value);
                        return result === value;
                    }
                }
            ]
        },
        {
            name: 'declaration',
            children: [
                {
                    name: 'array-notation',
                    run: transpile`(function(value) {
                        var [a] = value;
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn([value]);
                        return result === value;
                    }
                },
                {
                    name: 'object-notation',
                    run: transpile`(function(value) {
                        var {a} = value;
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn({a: value});
                        return result === value;
                    }
                }
            ],
            dependentChildren: [
                {
                    name: 'array-notation-chain-object-notation',
                    run: transpile`(function(array, object) {
                        var [a] = array, {b} = object;
                        return [a, b];
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn([value], {b: value});
                        return sameValues(result, [value, value]);
                    }
                },
                {
                    name: 'array-notation-nest-object-notation',
                    run: transpile`(function(value) {
                        var [{a}] = value;
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn([{a: value}]);
                        return result === value;
                    }
                },
                {
                    name: 'object-notation-nest-array-notation',
                    run: transpile`(function(value) {
                        var {a:[a]} = value;
                        return a;
                    })`,
                    complete(fn) {
                        var value = 1;
                        var result = fn({a: [value]});
                        return result === value;
                    }
                }
            ]
        },
        {
            name: 'parameters'
        }
    ]
};

export default test;
