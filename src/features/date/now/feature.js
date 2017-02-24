import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'now';
const feature = {
    run: at(parent.run, methodName),
    test: expect(present),
    solution: {
        type: 'inline',
        value: now
    }
};
export default feature;

function now() {
    return new Date().getTime();
}
export {now};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, now);
}
export {fix};
