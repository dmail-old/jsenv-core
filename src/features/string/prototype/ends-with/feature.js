import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';

const methodName = 'endsWith';
const feature = {
    dependencies: [parent],
    run: at(parent.run, methodName),
    test: expect(present),
    solution: {
        type: 'inline',
        value: fix
    }
};

import {objectIsCoercible} from 'helper/fix.js';
// https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/String/endsWith
function endsWith(searchString, position) {
    objectIsCoercible(this);
    var subjectString = String(this);
    if (
        typeof position !== 'number' ||
        !isFinite(position) ||
        Math.floor(position) !== position ||
        position > subjectString.length
    ) {
        position = subjectString.length;
    }
    position -= searchString.length;
    var lastIndex = subjectString.lastIndexOf(searchString, position);
    return lastIndex !== -1 && lastIndex === position;
}

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, endsWith);
}

export default feature;
export {endsWith, fix};

