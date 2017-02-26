import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'defineProperty';
const feature = {
    run: at(parent.run, methodName),
    test: expect(present, function(defineProperty) {
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
export default feature;

import {assertObject, toPrimitive} from 'helper/fix.js';
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
export {defineProperty};

import {defineMethod} from 'helper/fix.js';
function fix() {
    defineMethod(at(parent.run).value, methodName, defineProperty);
}
export {fix};
