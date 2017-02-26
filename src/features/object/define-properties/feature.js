import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'defineProperties';
const feature = {
    dependencies: [parent],
    run: at(parent.run, methodName),
    test: expect(present)
};
export default feature;

import {assertObject} from 'helper/fix.js';
import {solution as keysSolution} from '../keys/feature.js';
import {solution as definePropertySolution} from '//object/define-property/feature.js';
const solution = {
    dependencies: [keysSolution, definePropertySolution],
    type: 'inline',
    value: function() {
        Object.defineProperties = defineProperties;
    }
};
function defineProperties(object, properties) {
    assertObject(object);
    const names = Object.keys(object);
    let i = 0;
    const j = names.length;
    while (i < j) {
        let name = names[i];
        Object.defineProperty(object, name, properties[name]);
        i++;
    }
    return object;
}
export {solution};

