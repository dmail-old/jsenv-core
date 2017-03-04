import '/object/is-frozen/test.js';
import {transpile, sameValues} from '/test-helpers.js';

const test = {
    run: transpile`(function(a) {
        return \`foo
            \$\{a + 'z'\} \$\{a.toUpperCase()\}\`;
    })`,
    complete(fn) {
        var value = 'bar';
        var result = fn(value);
        return result === 'foo\nbarz BAR';
    },
    children: [
        {
            name: 'line-break-normalization',
            run: transpile`(function(a) {
                return [
                    \`x\ry\`,
                    \`x\ny\`,
                    \`x\r\ny\`,
                ];
            })`,
            complete(fn) {
                var result = fn();
                var carriageReturn = result[0];
                var linefeedReturn = result[1];
                var carriageAndLineFeedReturn = result[2];
                return (
                    carriageReturn.length === 3 &&
                    carriageReturn[1] === '\r' &&
                    linefeedReturn.length === 3 &&
                    linefeedReturn[1] === '\n' &&
                    carriageAndLineFeedReturn.length === 3 &&
                    carriageAndLineFeedReturn[1] === '\n'
                );
            }
        },
        {
            name: 'return-to-string',
            run: transpile`(function(a) {
                return \`\$\{a\}\`;
            })`,
            complete(fn) {
                var value = 1;
                var result = fn({
                    toString() {
                        return value;
                    },
                    valueOf() {
                        return 'bar';
                    }
                });
                return result === String(value);
            }
        },
        {
            name: 'tagged',
            run: transpile`(function(tag, value) {
                return tag \`foo\n\$\{value\}\`;
            })`,
            complete: every(
                function(fn) {
                    var called = false;
                    var calledWith;
                    var value = 1;
                    function tag() {
                        called = true;
                        calledWith = arguments;
                    }
                    fn(tag, value);
                    var parts = calledWith[0];
                    return (
                        called &&
                        sameValues(parts, ['foo\n']) &&
                        sameValues(parts.raw, ['foo\\n']) &&
                        sameValues(calledWith.slice(1), [value])
                    );
                },
                function() {
                    var parts;
                    function tag() {
                        parts = arguments[0];
                    }
                    fn(tag);

                    return (
                        Object.isFrozen(parts) &&
                        Object.isFrozen(parts.raw)
                    );
                }
            )
        }
    ]
};

export default test;
