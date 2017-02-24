import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'trimStart';
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
import {startSpaceRegExp} from '../feature.js';
function trimStart() {
    objectIsCoercible(this);
    var string = String(this);
    return string.replace(startSpaceRegExp, '');
}
export {trimStart};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, trimStart);
}
export {fix};
