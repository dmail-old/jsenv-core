import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'padStart';
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

import {objectIsCoercible, toLength} from 'helper/fix.js';
// https://github.com/tc39/proposal-string-pad-start-end/blob/master/polyfill.js
function padStart(maxLength, fillString) {
    var object = this;
    objectIsCoercible(object);
    var string = String(object);
    var intMaxLength = toLength(maxLength);
    var stringLength = toLength(string.length);
    if (intMaxLength <= stringLength) {
        return string;
    }
    var filler = typeof fillString === 'undefined' ? ' ' : String(fillString);
    if (filler === '') {
        return string;
    }
    var fillLen = intMaxLength - stringLength;
    while (filler.length < fillLen) {
        var fLen = filler.length;
        var remainingCodeUnits = fillLen - fLen;
        if (fLen > remainingCodeUnits) {
            filler += filler.slice(0, remainingCodeUnits);
        } else {
            filler += filler;
        }
    }
    var truncatedStringFiller = filler.slice(0, fillLen);
    return truncatedStringFiller + string;
}
export {padStart};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, padStart);
}
export {fix};
