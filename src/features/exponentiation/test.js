import {transpile} from '/test-helpers.js';

const test = {
    run: transpile`(function(left, right, negate) {
        if (negate) {
            return -(left ** right);
        }
        return left ** right;
    })`,
    complete(fn) {
        return (
            fn(2, 3) === 8 &&
            fn(-5, 2) === 25 &&
            fn(5, 2, true) === -25
        );
    },
    children: [
        {
            name: 'assignment',
            run: transpile`(function(value, operand) {
                value **= operand;
                return value;
            })`,
            complete(fn) {
                return fn(2, 3) === 8;
            }
        },
        {
            name: 'throw-on-negative-without-parenthesis',
            run: transpile`(function() {
                -5 ** 2;
            })`,
            crash(error) {
                return error.name === 'SyntaxError';
            }
        }
    ]
};

export default test;
