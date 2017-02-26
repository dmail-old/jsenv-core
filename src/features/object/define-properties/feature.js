import {at, present} from '/helper/detect.js';
import {test as objectTest} from '../feature.js';
const methodName = 'defineProperties';
const test = {
    dependencies: [objectTest],
    run: at(objectTest.run, methodName),
    complete: present
};
export {test};

import {assertObject} from '/helper/fix.js';
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
import {polyfill} from '/helper/fix.js';
import {solution as keysSolution} from '../keys/feature.js';
import {solution as definePropertySolution} from '../define-property/feature.js';
const solution = polyfill(Object, methodName, defineProperties);
solution.dependencies = [keysSolution, definePropertySolution];
export {solution};
