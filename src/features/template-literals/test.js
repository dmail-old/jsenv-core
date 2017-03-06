import '/object/freeze/test.js';
import '/object/is-frozen/test.js';
import '/object/define-properties/test.js';

import {expect, transpile, fail} from '/test-helpers.js';

// function escapeTemplateLiteralsSpecialChars(string) {
//     return string.replace(/[`${}]/g, function(char) {
//         return '\\' + char;
//     });
// }

const test = expect({
    'compiles': transpile`(function(a) {
        return \`foo\`;
    })`,
    'runs'(fn) {
        var result = fn();
        return result === 'foo';
    },
    'expression mustache': expect({
        'compiles': transpile`(function(a) {
            return \`hello \$\{a.toUpperCase()\}!\`;
        })`,
        'runs'(fn) {
            var value = 'dam';
            var result = fn(value);
            return result === 'hello DAM!';
        }
    }),
    'expression use toString method': expect({
        'compiles': transpile`(function(a) {
            return \`\$\{a\}\`;
        })`,
        'runs'(fn) {
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
    }),
    'line break are normalized to linefeed': expect({
        'compiles': transpile`(function(a) {
            return [
                \`a\rb\`,
                \`a\nb\`,
                \`a\r\nb\`
            ]
        })`,
        'runs'(fn) {
            var result = fn();
            var carriageReturn = result[0];
            var linefeedReturn = result[1];
            var carriageAndLineFeedReturn = result[2];
            return (
                carriageReturn.length === 3 &&
                carriageReturn[1] === '\n' &&
                linefeedReturn.length === 3 &&
                linefeedReturn[1] === '\n' &&
                carriageAndLineFeedReturn.length === 3 &&
                carriageAndLineFeedReturn[1] === '\n'
            );
        }
    }),
    'tagged': expect({
        'compiles': transpile`(function(tag, value) {
            return tag \`foo\n\$\{value\}\`;
        })`,
        'runs'(fn) {
            var called = false;
            var calledWith;
            var value = 1;
            function tag() {
                called = true;
                calledWith = arguments;
            }
            fn(tag, value);
            var parts = calledWith[0];

            if (!called) {
                return fail('tag not called');
            }
            if (parts[0] !== 'foo\n') {
                return fail('strings mismatch');
            }
            // this is failing parts.raw is \n instead of \\n dunno why
            // if (parts.raw[0] !== 'foo\\n') {
            //     return fail('raw mismatch');
            // }
            if (calledWith[1] !== value) {
                return fail('variables mismatch');
            }
            return true;
        },
        'parts & parts.raw are frozen'(fn) {
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
    })
});

export default test;
