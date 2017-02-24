import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'trimEnd';
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
import {endSpaceRegExp} from '../feature.js';
function trimEnd() {
    objectIsCoercible(this);
    var string = String(this);
    return string.replace(endSpaceRegExp, '');
}
export {trimEnd};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, trimEnd);
}
export {fix};
