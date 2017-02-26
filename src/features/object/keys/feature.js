import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
const methodName = 'keys';
const feature = {
    dependencies: [parent],
    run: at(parent.run, methodName),
    test: expect(present)
};
export default feature;

import {toIterable, hasOwnProperty, getSharedKey} from 'helper/fix.js';
const solution = {
    type: 'inline',
    value: function() {
        Object.keys = keys;
    }
};
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
export {solution};
