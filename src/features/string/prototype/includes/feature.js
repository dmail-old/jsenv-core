import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'includes';
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
function includes(search, start) {
    objectIsCoercible(this);
    var string = String(this);
    if (typeof start !== 'number') {
        start = 0;
    }

    if (start + search.length > string.length) {
        return false;
    }
    return string.indexOf(search, start) !== -1;
}
export {includes};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, includes);
}
export {fix};
