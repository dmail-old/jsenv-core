import '/promise/test.js';
import '/function/generator/test.js';

import {transpile, everyAsync} from '/test-helpers.js';

const test = {
    run: transpile`(async function(value) {
        return value;
    })`,
    complete: everyAsync(
        function(fn) {
            var value;
            var result = fn(value);
            if (result instanceof Promise === false) {
                return false;
            }
            return result.then(function(resolutionValue) {
                return resolutionValue === value;
            });
        },
        function(fn) {
            return fn.hasOwnProperty('prototype') === false;
        }
    ),
    children: [
        {
            name: 'await',
            run: transpile`(async function(thenable) {
                var result = await thenable;
                return result;
            })`,
            complete: everyAsync(
                function(fn) {
                    var value = 10;
                    var thenable = Promise.resolve(value);
                    var result = fn(thenable);
                    return result.then(function(resolutionValue) {
                        return resolutionValue === value;
                    });
                },
                function(fn) {
                    var value = 10;
                    var result = fn(value);
                    return result.then(function(resolutionValue) {
                        return resolutionValue === value;
                    });
                }
            ),
            children: [
                {
                    name: 'throw-on-missing-value',
                    run: transpile`(async function() {
                        await;
                    })`,
                    crash(error) {
                        return error.name === 'SyntaxError';
                    }
                },
                {
                    name: 'throw-on-rejected-thenable',
                    run: transpile`(async function(thenable) {
                        try {
                            var result = await thenable;
                        } catch (e) {
                            return e;
                        }
                    })`,
                    pass: function(fn) {
                        var value = 1;
                        var thenable = Promise.reject(value);
                        var result = fn(thenable);
                        return result.then(function(resolutionValue) {
                            return resolutionValue === value;
                        });
                    }
                }
            ]
        },
        {
            name: 'no-line-break',
            run: transpile`(async
            function(value) {})`,
            crash(error) {
                return error.name === 'SyntaxError';
            }
        },
        {
            name: 'shorthand-notation',
            run: transpile`(function(value) {
                return {
                    async a() {
                        return await value;
                    }
                };
            })`,
            complete(fn) {
                var value;
                var result = fn(value);
                var promise = result.a();
                return promise.then(function(resolutionValue) {
                    return resolutionValue === value;
                });
            }
        },
        {
            name: 'throw-return-rejected-promise',
            run: transpile`(async function(value) {
                throw value;
            })`,
            complete(fn) {
                var value;
                var result = fn(value);
                if (result instanceof Promise === false) {
                    return false;
                }
                return result.catch(function(rejectionValue) {
                    return rejectionValue === value;
                });
            }
        }
    ]
};

export default test;
