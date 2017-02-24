import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'trim';
const feature = {
    dependencies: [parent],
    run: at(parent.run, methodName),
    test: expect(present),
    solution: {
        type: 'inline',
        value: fix
    }
};
export default feature;

const whiteSpaces = [
    '\x09',
    '\x0A',
    '\x0B',
    '\x0C',
    '\x0D',
    '\x20',
    '\xA0',
    '\u1680',
    '\u180E',
    '\u2000',
    '\u2001',
    '\u2002',
    '\u2003',

    '\u2004',
    '\u2005',
    '\u2006',
    '\u2007',
    '\u2008',
    '\u2009',
    '\u200A',
    '\u202F',
    '\u205F',
    '\u3000',
    '\u2028',
    '\u2029',
    '\uFEFF'
];
const allWhiteSpaceString = whiteSpaces.join('');
const startSpaceRegexp = RegExp('^' + allWhiteSpaceString + allWhiteSpaceString + '*');
const endSpaceRegExp = RegExp(allWhiteSpaceString + allWhiteSpaceString + '*$');
export {startSpaceRegexp, endSpaceRegExp};

import {objectIsCoercible} from 'helper/fix.js';
// https://github.com/zloirock/core-js/blob/master/modules/_string-trim.js
function trim() {
    objectIsCoercible(this);
    var string = String(this);
    return string.replace(startSpaceRegexp, '').replace(endSpaceRegExp, '');
}
export {trim};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, trim);
}
export {fix};
