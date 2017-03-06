import '/promise/test.js';
import '/function/generator/test.js';
import '/function/arrow/test.js';

import {expect, transpile, expectThrow} from '/test-helpers.js';

const test = expect({
    'compiles': transpile`(async function(value) {
        return value;
    })`,
    'runs'(asyncFn) {
        var value;
        var result = asyncFn(value);
        if (result instanceof Promise === false) {
            return false;
        }
        return result.then(function(resolutionValue) {
            return resolutionValue === value;
        });
    },
    // babel does not provide this
    // 'has no prototype'(asyncFn) {
    //     return asyncFn.hasOwnProperty('prototype') === false;
    // },
    'await': expect({
        'compiles': transpile`(async function(thenable) {
            var result = await thenable;
            return result;
        })`,
        'works with thenable'(asyncFn) {
            var value = 10;
            var thenable = Promise.resolve(value);
            var result = asyncFn(thenable);
            return result.then(function(resolutionValue) {
                return resolutionValue === value;
            });
        },
        'works with non thenable'(asyncFn) {
            var value = 10;
            var result = asyncFn(value);
            return result.then(function(resolutionValue) {
                return resolutionValue === value;
            });
        },
        'throw on missing value': expectThrow(
            transpile`(async function() {
                await;
            })`,
            {name: 'SyntaxError'}
        ),
        'throw on rejected thenable': expect({
            'compiles': transpile`(async function(thenable) {
                try {
                    var result = await thenable;
                } catch (e) {
                    return e;
                }
            })`,
            'runs'(asyncFn) {
                var value = 1;
                var thenable = Promise.reject(value);
                var result = asyncFn(thenable);
                return result.then(function(resolutionValue) {
                    return resolutionValue === value;
                });
            }
        }),
        'no line break': expectThrow(
            transpile`(async
            function(value) {})`,
            {name: 'SyntaxError'}
        ),
        'shorthand-notation': expect({
            'compiles': transpile`(function(value) {
                return {
                    async a() {
                        return await value;
                    }
                };
            })`,
            'runs'(fn) {
                var value;
                var result = fn(value);
                var promise = result.a();
                return promise.then(function(resolutionValue) {
                    return resolutionValue === value;
                });
            }
        }),
        'throw returns a rejected promise': expect({
            'compiles': transpile`(async function(value) {
                throw value;
            })`,
            'runs'(fn) {
                var value;
                var result = fn(value);
                if (result instanceof Promise === false) {
                    return false;
                }
                return result.catch(function(rejectionValue) {
                    return rejectionValue === value;
                });
            }
        })
    })
});

export default test;
