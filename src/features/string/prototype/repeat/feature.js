import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'repeat';
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

import {objectIsCoercible} from 'helper/fix.js';
// https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/String/repeat
function repeat(count) {
    objectIsCoercible(this);
    var str = String(this);
    count = Number(count);
    if (isNaN(count)) {
        count = 0;
    }
    if (count < 0) {
        throw new RangeError('repeat count must be non-negative');
    }
    if (count === Infinity) {
        throw new RangeError('repeat count must be less than infinity');
    }
    count = Math.floor(count);
    if (str.length === 0 || count === 0) {
        return "";
    }
    if (str.length * count >= 1 << 28) {
        throw new RangeError('repeat count must not overflow maximum string size');
    }
    var rpt = "";
    for (;;) {
        if ((count & 1) === 1) {
            rpt += str;
            count >>>= 1;
        }
        if (count === 0) {
            break;
        }
        str += str;
    }
    return rpt;
}
export {repeat};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, repeat);
}
export {fix};
