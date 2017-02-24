import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'escapeHTML';
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
function escapeHTML() {
    objectIsCoercible(this);
    var string = String(this);
    return string.replace(/[&<"']/g, function(char) {
        if (char === '&') {
            return '&amp;';
        }
        if (char === '<') {
            return '&lt;';
        }
        if (char === '>') {
            return '&gt;';
        }
        if (char === '"') {
            return '&quot;';
        }
        if (char === '\'') {
            return '&apos;';
        }
        return '&#039;';
    });
}
export {escapeHTML};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, escapeHTML);
}
export {fix};
