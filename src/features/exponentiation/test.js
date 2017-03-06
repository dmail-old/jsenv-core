import {expect, transpile, expectThrow} from '/test-helpers.js';

const test = expect({
    'compiles': transpile`(function(left, right, negate) {
        if (negate) {
            return -(left ** right);
        }
        return left ** right;
    })`,
    'runs'(fn) {
        return (
            fn(2, 3) === 8 &&
            fn(-5, 2) === 25 &&
            fn(5, 2, true) === -25
        );
    },
    'assignment': expect({
        'compiles': transpile`(function(value, operand) {
            value **= operand;
            return value;
        })`,
        'runs'(fn) {
            return fn(2, 3) === 8;
        }
    }),
    'throw-on-negative-without-parenthesis': expectThrow(
        transpile`(function() {
            -5 ** 2;
        })`,
        {name: 'SyntaxError'}
    )
});

export default test;
