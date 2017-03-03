import {transpile} from '/test-helpers.js';

const test = {
    children: [
        {
            name: 'properties',
            run: transpile`(function(a, b) {
                return {a, b};
            })`,
            complete(fn) {
                var a = 1;
                var b = 2;
                var result = fn(a, b);

                return (
                    result.a === a &&
                    result.b === b
                );
            }
        },
        {
            name: 'methods',
            run: transpile`(function() {
                return {
                    y() {}
                };
            })`,
            complete(fn) {
                const result = fn();
                return typeof result.y === 'function';
            },
            children: [
                {
                    name: 'lexical-binding',
                    skipped: true,
                    skipReason: 'cannot-be-fixed',
                    run: transpile`(function(value) {
                        var f = value;
                        return ({
                            f() {
                                return f;
                            }
                        });
                    })`,
                    complete(fn) {
                        var value = 1;
                        return fn(value).f() === value;
                    }
                }
            ]
        }
    ]
};

export default test;
