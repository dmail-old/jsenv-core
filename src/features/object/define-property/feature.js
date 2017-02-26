import {at, present, every} from 'helper/detect.js';
import {test as objectTest} from '../feature.js';
const methodName = 'defineProperty';
const test = {
    dependencies: [objectTest],
    run: at(objectTest.run, methodName),
    complete: every(present, function(target) {
        const defineProperty = target.value;
        const object = {};
        const name = 'a';
        const value = 7;
        try {
            defineProperty(object, 'a', {
                get: function() {
                    return value;
                }
            });
            return object[name] === value;
        } catch (e) {
            return false;
        }
    })
};
export {test};

import {assertObject, toPrimitive, polyfill} from 'helper/fix.js';
function defineProperty(object, propertyName, attributes) {
    assertObject(object);
    propertyName = toPrimitive(propertyName, String);
    assertObject(attributes);
    if ('get' in attributes || 'set' in attributes) {
        throw new TypeError('Accessors not supported!');
    }
    if ('value' in attributes) {
        object[propertyName] = attributes.value;
    }
    return object;
}
const solution = polyfill(Object, methodName, defineProperty);
export {solution};
