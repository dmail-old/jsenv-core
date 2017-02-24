import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'unescapeHTML';
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
function unescapeHTML() {
    objectIsCoercible(this);
    return String(this).replace(/&(?:amp|lt|gt|quot|apos);/g, function(char) {
        if (char === '&amp;') {
            return '&';
        }
        if (char === '&lt;') {
            return '<';
        }
        if (char === '&gt;') {
            return '>';
        }
        if (char === '&quot;') {
            return '"';
        }
        if (char === '&apos;') {
            return '\'';
        }
        return char;
    });
}
export {unescapeHTML};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, unescapeHTML);
}
export {fix};
