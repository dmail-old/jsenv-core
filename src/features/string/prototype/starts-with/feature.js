import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'startsWith';
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
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
function startsWith(searchString, position) {
    objectIsCoercible(this);
    var string = String(this);
    position = position || 0;
    return string.substr(position, searchString.length) === searchString;
}
export {startsWith};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, startsWith);
}
export {fix};
