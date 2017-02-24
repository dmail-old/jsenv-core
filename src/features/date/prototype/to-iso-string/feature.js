import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'toISOString';
const feature = {
    run: at(parent.run, methodName),
    test: expect(present),
    solution: {
        type: 'inline',
        value: toISOString
    }
};
export default feature;

const getTime = Date.prototype.getTime;
function lz(num) {
    return num > 9 ? num : '0' + num;
}
function toISOString() { // eslint-disable-line no-unused-expressions
    if (!isFinite(getTime.call(this))) {
        throw new RangeError('Invalid time value');
    }
    var d = this;
    var y = d.getUTCFullYear();
    var m = d.getUTCMilliseconds();

    var result;
    if (y < 0) {
        result = '-';
    } else if (y > 9999) {
        result = '+';
    } else {
        result = '';
    }
    result += ('00000' + Math.abs(y)).slice(result === '' ? -4 : -6);
    result += '-' + lz(d.getUTCMonth() + 1) + '-' + lz(d.getUTCDate());
    result += 'T' + lz(d.getUTCHours()) + ':' + lz(d.getUTCMinutes());
    result += ':' + lz(d.getUTCSeconds()) + '.' + (m > 99 ? m : '0' + lz(m)) + 'Z';

    return result;
}
export {toISOString};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, toISOString);
}
export {fix};
