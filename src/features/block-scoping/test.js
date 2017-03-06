import '/for-of/test.js';

import {expect, transpile, sameValues, collectKeys} from '/test-helpers.js';

const test = expect({
    'const': expect({
        'compiles': transpile`(function(value) {
            const result = value;
            return result;
        })`,
        'runs'(fn) {
            var value = 1;
            var result = fn(value);
            return result === value;
        },
        'scoped inside block': expect({
            'compiles': transpile`(function(outsideValue, insideValue) {
                const a = outsideValue;
                {
                    const a = insideValue;
                }
                return a;
            })`,
            'runs'(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var returnValue = fn(outsideValue, insideValue);
                return returnValue === outsideValue;
            }
        }),
        'scoped inside for in expression': expect({
            'compiles': transpile`(function(value) {
                var scopes = [];
                for(const i in value) {
                    scopes.push(function() {
                        return i;
                    });
                }
                return scopes;
            })`,
            'runs'(fn) {
                var value = [0, 1];
                var scopes = fn(value);
                var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
                    return scope();
                });
                return sameValues(scopeValues, collectKeys(value));
            }
        }),
        'scoped inside for of expression': expect({
            'compiles': transpile`(function(value) {
                var scopes = [];
                for(const i of value) {
                    scopes.push(function() {
                        return i;
                    });
                }
                return scopes;
            })`,
            'runs'(fn) {
                var value = ['a', 'b'];
                var scopes = fn(value);
                var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
                    return scope();
                });
                return sameValues(scopeValues, value);
            }
        }),
        'scoped inside for initializer': expect({
            'compiles': transpile`(function(outsideValue, insideValue) {
                const foo = outsideValue;
                for(const foo = insideValue; false;) {}
                return foo;
            })`,
            'runs'(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var result = fn(outsideValue, insideValue);
                return result === outsideValue;
            }
        }),
        'temporal dead zone': expect({
            'compiles': transpile`(function(value) {
                var result;
                function fn() {
                    result = foo;
                }
                const foo = value;
                fn();
                return result;
            })`,
            'runs'(fn) {
                var value = 10;
                var result = fn(value);
                return result === value;
            }
        })
    }),

    'let': expect({
        'compiles': transpile`(function(value) {
            let result = value;
            return result;
        })`,
        'runs'(fn) {
            var value = 123;
            var result = fn(value);
            return result === value;
        },
        'scoped inside block': expect({
            'compiles': transpile`(function(outsideValue, insideValue) {
                let result = outsideValue;
                {
                    let result = insideValue;
                }
                return result;
            })`,
            'runs'(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var result = fn(outsideValue, insideValue);
                return result === outsideValue;
            }
        }),
        'scoped inside for in expression': expect({
            'compiles': transpile`(function(iterable) {
                var scopes = [];
                for(let i in iterable) {
                    scopes.push(function() {
                        return i;
                    });
                }
                return scopes;
            })`,
            'runs'(fn) {
                var iterable = [0, 1];
                var scopes = fn(iterable);
                var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
                    return scope();
                });
                return sameValues(scopeValues, collectKeys(iterable));
            }
        }),
        'scoped inside for of expression': expect({
            'compiles': transpile`(function(outsideValue, insideValue) {
                let result = outsideValue;
                for(let result = insideValue; false;) {}
                return result;
            })`,
            'runs'(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var result = fn(outsideValue, insideValue);
                return result === outsideValue;
            }
        }),
        'scoped inside for initializer': expect({
            'compiles': transpile`(function(outsideValue, insideValue) {
                let result = outsideValue;
                for(let result = insideValue; false;) {}
                return result;
            })`,
            'runs'(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var result = fn(outsideValue, insideValue);
                return result === outsideValue;
            }
        }),
        'temporal dead zone': expect({
            'compiles': transpile`(function(value) {
                var result;
                function fn() {
                    result = foo;
                }
                let foo = value;
                fn();
                return result;
            })`,
            'runs'(fn) {
                var value = 10;
                var result = fn(value);
                return result === value;
            }
        })
    })
});

export default test;
