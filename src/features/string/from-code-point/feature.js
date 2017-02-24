import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';

const path = 'fromCodePoint';
const feature = {
    dependencies: [parent],
    run: at(parent.run, path),
    test: expect(present, function(fromCodePoint, pass, fail) {
        if (fromCodePoint.length !== 1) {
            return fail('length-must-be-one');
        }
        return pass();
    }),
    solution: {
        type: 'inline',
        value: fix
    }
};

const stringFromCharCode = String.fromCharCode;
const floor = Math.floor;
function fromCodePoint(x) { // eslint-disable-line no-unused-vars
    var MAX_SIZE = 0x4000;
    var codeUnits = [];
    var highSurrogate;
    var lowSurrogate;
    var index = -1;
    var length = arguments.length;
    if (!length) {
        return '';
    }
    var result = '';
    while (++index < length) {
        var codePoint = Number(arguments[index]);
        if (
            !isFinite(codePoint) ||       // `NaN`, `+Infinity`, or `-Infinity`
            codePoint < 0 ||              // not a valid Unicode code point
            codePoint > 0x10FFFF ||       // not a valid Unicode code point
            floor(codePoint) !== codePoint // not an integer
        ) {
            throw new RangeError('Invalid code point: ' + codePoint);
        }
        if (codePoint <= 0xFFFF) { // BMP code point
            codeUnits.push(codePoint);
        } else { // Astral code point; split in surrogate halves
            // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            codePoint -= 0x10000;
            highSurrogate = (codePoint >> 10) + 0xD800;
            lowSurrogate = (codePoint % 0x400) + 0xDC00;
            codeUnits.push(highSurrogate, lowSurrogate);
        }
        if (index + 1 === length || codeUnits.length > MAX_SIZE) {
            result += stringFromCharCode.apply(null, codeUnits);
            codeUnits.length = 0;
        }
    }
    return result;
}

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, path, fromCodePoint);
}

export default feature;
export {fromCodePoint, fix};
