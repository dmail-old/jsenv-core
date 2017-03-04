// https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-float.js
import {at, presence, every} from '/test-helpers.js';

const whitespaces = (
    '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003' +
    '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF'
);
const test = {
    run: at('parseFloat'),
    complete: every(
        presence,
        function() {
            return 1 / parseFloat(whitespaces + '-0') === -Infinity;
        }
    )
};

export default test;
export {whitespaces};
