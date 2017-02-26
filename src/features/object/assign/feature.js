import {at, present} from '/helper/detect.js';
import {test as objectTest} from '../feature.js';
const methodName = 'assign';
const test = {
    dependencies: [objectTest],
    run: at(objectTest.run, methodName),
    complete: present
};
export {test};

import {toObject, toIterable, isEnumerable} from '/helper/fix.js';
import {solution as keysSolution} from '../keys/feature.js';
const getOwnPropertySymbols = Object.getOwnPropertySymbols;
function assign(target, source) { // eslint-disable-line no-unused-vars
    var object = toObject(target);
    var length = arguments.length;
    var index = 1;
    while (index < length) {
        var sourceArg = toIterable(arguments[index]);
        var keys = Object.keys(sourceArg);
        if (getOwnPropertySymbols) {
            keys.push.apply(keys, getOwnPropertySymbols(sourceArg));
        }
        var i = 0;
        var j = keys.length;
        while (i < j) {
            let key = keys[i];
            if (isEnumerable(sourceArg, key)) {
                object[key] = sourceArg[key];
            }
            i++;
        }
        index++;
    }
    return object;
}
const solution = {
    dependencies: [keysSolution],
    type: 'inline',
    value: function() {
        Object[methodName] = assign;
    }
};
export {solution};
