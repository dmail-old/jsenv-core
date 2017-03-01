import {toIterable, hasOwnProperty, getSharedKey} from '/fix-helpers.js';

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
const fix = {
    type: 'inline',
    value: function fixObjectKeys() {
        Object.keys = keys;
    }
};

export default fix;
