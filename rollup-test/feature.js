import parent from './parent.js';
import dependency from './dependency.js';
import {at, expect, present} from 'helper/detect';

var path = 'trimEnd';
var feature = {
    dependencies: [parent, dependency],
    run: at(parent.run, dependency.run, path),
    test: expect(present),
    solution: {
        type: 'inline',
        value: fix
    }
};

import {objectIsCoercible, defineMethod} from 'helper/fix';
var whiteSpaces = [
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
var regexp = new RegExp(whiteSpaces.join('') + whiteSpaces.join('') + '*$');
function trimEnd() {
    objectIsCoercible(this);
    var string = String(this);
    return string.replace(regexp, '');
}
function fix() {
    defineMethod(at(parent.run).value, path, trimEnd);
}

export default feature;
export {whiteSpaces, regexp, trimEnd, fix};
