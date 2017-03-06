// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
import {expect, transpile, expectThrow} from '/test-helpers.js';

const test = expect({
    'compiles': transpile`((a) => a)`,
    'runs'(arrowFn) {
        var value = 1;
        var result = arrowFn(value);
        return result === value;
    },
    // babel does not provide this
    // 'has no prototype'(arrowFn) {
    //     return arrowFn.hasOwnProperty('prototype') === false;
    // },
    'explicit-body': expect({
        'compiles': transpile`((a) => {
            a++;
            return a;
        })`,
        'runs'(arrowFn) {
            return arrowFn(1) === 2;
        }
    }),
    'lexical-arguments-binding': expect({
        'compiles': transpile`(function() {
            return a => arguments[0];
        })`,
        'runs'(arrowFactory) {
            var value = 1;
            var otherValue = 2;
            var arrowFn = arrowFactory(value);
            var result = arrowFn(otherValue);
            return result === value;
        }
    }),
    'lexical-this-binding': expect({
        'compiles': transpile`(function() {
            return () => this;
        })`,
        'runs'(arrowFactory) {
            var value = {};
            var arrowFn = arrowFactory.call(value);
            var result = arrowFn();
            // when called a primitive like 1 is converted to an object
            // that's why I do result.valueOf() in case I had written value = 1 above
            return result.valueOf() === value;
        },
        'cannot be changed by call,apply,bind'(arrowFactory) {
            var value = 1;
            var arrowFn = arrowFactory.call(value);
            var callResult = arrowFn.call(2);
            var applyResult = arrowFn.apply(3);
            var bindResult = arrowFn.bind(4)();
            return (
                callResult.valueOf() === value &&
                applyResult.valueOf() === value &&
                bindResult.valueOf() === value
            );
        }
    }),
    'no-line-break': expectThrow(
        transpile`(()
        => 2)`,
        {name: 'SyntaxError'}
    ),
    'return-object-literals': expect({
        'compiles': transpile`((a) => ({
            value: a
        }))`,
        'runs'(arrowFn) {
            var value = 1;
            var result = arrowFn(value);
            return result.value === value;
        }
    }),
    'throw-precedence': expectThrow(
        transpile`(0 || () => 2)`,
        {name: 'SyntaxError'}
    )
});

export default test;
