import '/for-of/test.js';
import {transpile, sameValues, collectKeys} from '/test-helpers.js';

const test = {
    run: transpile`(function(value) {
        let result = value;
        return result;
    })`,
    complete(fn) {
        var value = 123;
        var result = fn(value);
        return result === value;
    },
    children: [
        {
            name: 'scoped',
            run: transpile`(function(outsideValue, insideValue) {
                let result = outsideValue;
                {
                    let result = insideValue;
                }
                return result;
            })`,
            complete(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var result = fn(outsideValue, insideValue);
                return result === outsideValue;
            }
        },
        {
            name: 'scoped-expression-for-in',
            run: transpile`(function(iterable) {
                var scopes = [];
                for(let i in iterable) {
                    scopes.push(function() {
                        return i;
                    });
                }
                return scopes;
            })`,
            complete(fn) {
                var iterable = [0, 1];
                var scopes = fn(iterable);
                var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
                    return scope();
                });
                return sameValues(scopeValues, collectKeys(iterable));
            }
        },
        {
            name: 'scoped-expression-for-of',
            run: transpile`(function(outsideValue, insideValue) {
                let result = outsideValue;
                for(let result = insideValue; false;) {}
                return result;
            })`,
            complete(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var result = fn(outsideValue, insideValue);
                return result === outsideValue;
            }
        },
        {
            name: 'scoped-for-initializer',
            run: transpile`(function(outsideValue, insideValue) {
                let result = outsideValue;
                for(let result = insideValue; false;) {}
                return result;
            })`,
            complete(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var result = fn(outsideValue, insideValue);
                return result === outsideValue;
            }
        },
        {
            name: 'temporal-dead-zone',
            run: transpile`(function(value) {
                var result;
                function fn() {
                    result = foo;
                }
                let foo = value;
                fn();
                return result;
            })`,
            complete(fn) {
                var value = 10;
                var result = fn(value);
                return result === value;
            }
        }
    ]
};

export default test;
