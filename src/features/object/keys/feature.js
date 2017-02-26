import {at, present} from '/helper/detect.js';
import {test as objectTest} from '../feature.js';
const methodName = 'keys';
const test = {
    dependencies: [objectTest],
    run: at(objectTest.run, methodName),
    complete: present
};
export {test};

import {toIterable, hasOwnProperty, getSharedKey} from '/helper/fix.js';
const IE_PROTO = getSharedKey('IE_PROTO');
function keys(object) {
    object = toIterable(object);
    var keys = [];
    var key;
    for (key in object) {
        if (key !== IE_PROTO && hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
}
const solution = {
    type: 'inline',
    value() {
        Object[methodName] = keys;
    }
};
export {solution};
