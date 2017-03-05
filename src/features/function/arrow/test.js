// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
import {transpile, every} from '/test-helpers.js';

const test = {
    run: transpile`((a) => a)`,
    complete: every(
        function(arrowFn) {
            var value = 1;
            var result = arrowFn(value);
            return result === value;
        },
        function(arrowFn) {
            return arrowFn.hasOwnProperty('prototype') === false;
        }
    ),
    children: [
        {
            name: 'explicit-body',
            run: transpile`((a) => {
                a++;
                return a;
            })`,
            complete(arrowFn) {
                return arrowFn(1) === 2;
            }
        },
        {
            name: 'lexical-arguments-binding',
            run: transpile`(function() {
                return a => arguments[0];
            })`,
            complete(arrowFactory) {
                var value = 1;
                var otherValue = 2;
                var arrowFn = arrowFactory(value);
                var result = arrowFn(otherValue);
                return result === value;
            }
        },
        {
            name: 'lexical-this-binding',
            run: transpile`(function() {
                return () => this;
            })`,
            complete: every(
                function(arrowFactory) {
                    var value = 1;
                    var arrowFn = arrowFactory.call(value);
                    var result = arrowFn();
                    return result === value;
                },
                function(arrowFactory) {
                    var value = 1;
                    var arrowFn = arrowFactory.call(value);
                    var callResult = arrowFn.call(2);
                    var applyResult = arrowFn.apply(3);
                    var bindResult = arrowFn.bind(4)();
                    return (
                        callResult === value &&
                        applyResult === value &&
                        bindResult === value
                    );
                }
            )
        },
        {
            name: 'no-line-break',
            run: transpile`(()
            => 2)`,
            crash(error) {
                return error.name === 'SyntaxError';
            }
        },
        {
            name: 'return-object-literals',
            run: transpile`((a) => ({
                value: a
            }))`,
            complete(arrowFn) {
                var value = 1;
                var result = arrowFn(value);
                return result.value === value;
            }
        },
        {
            name: 'throw-precedence',
            run: transpile`(0 || () => 2)`,
            crash(error) {
                return error.name === 'SyntaxError';
            }
        }
    ]
};

export default test;
