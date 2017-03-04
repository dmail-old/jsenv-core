import {transpile, sameValues, collectKeys, expectThrow} from '/test-helpers.js';

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
            name: 'scoped',
            run: transpile`(function(outsideValue, insideValue) {
                const a = outsideValue;
                {
                    const a = insideValue;
                }
                return a;
            })`,
            complete(fn) {
                var outsideValue = 0;
                var insideValue = 1;
                var returnValue = fn(outsideValue, insideValue);
                return returnValue === outsideValue;
            }
        },
        {
            name: 'scoped-expression-for-in',
            run: transpile`(function(value) {
                var scopes = [];
                for(const i in value) {
                    scopes.push(function() {
                        return i;
                    });
                }
                return scopes;
            })`,
            complete(fn) {
                var value = [0, 1];
                var scopes = fn(value);
                var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
                    return scope();
                });
                return sameValues(scopeValues, collectKeys(value));
            }
        },
        {
            name: 'scoped-for-initializer',
            run: transpile`(function(outsideValue, insideValue) {
                const foo = outsideValue;
                for(const foo = insideValue; false;) {}
                return foo;
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
                const foo = value;
                fn();
                return result;
            })`,
            complete(fn) {
                var value = 10;
                var result = fn(value);
                return result === value;
            }
        },
        {
            name: 'throw-redefine',
            skipped: true, // because not fixed by babel
            run: transpile`(function() {
                const foo = 1;
                foo = 2;
            })`,
            complete: expectThrow(function(fn) {
                fn();
            })
        },
        {
            name: 'throw-statement',
            skipped: true, // because not fixed by babel
            run: transpile`(function() {
                if (true) const bar = 1;
            })`,
            complete: expectThrow(
                function(fn) {
                    fn();
                },
                {name: 'SyntaxError'}
            )
        }
    ]
};

export default test;
