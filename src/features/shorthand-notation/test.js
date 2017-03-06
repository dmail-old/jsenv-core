import {expect, transpile} from '/test-helpers.js';

const test = expect({
    'properties': expect({
        'compiles': transpile`(function(a, b) {
            return {a, b};
        })`,
        'runs'(fn) {
            var a = 1;
            var b = 2;
            var result = fn(a, b);

            return (
                result.a === a &&
                result.b === b
            );
        }
    }),
    'methods': expect({
        'compiles': transpile`(function() {
            return {
                y() {}
            };
        })`,
        'runs'(fn) {
            const result = fn();
            return typeof result.y === 'function';
        }
    })
});

export default test;
