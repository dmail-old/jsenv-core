import {at, expect, present} from 'helper/detect.js';
import {default as parent, expectLowerCaseAndAttribute, createHTML} from '../feature.js';
const methodName = 'small';
const feature = {
    dependencies: [parent],
    run: at(parent.run, methodName),
    test: expect(present, expectLowerCaseAndAttribute),
    solution: {
        type: 'inline',
        value: fix
    }
};
export default feature;

function small() {
    return createHTML(this, 'small');
}
export {small};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, small);
}
export {fix};
