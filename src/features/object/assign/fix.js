import objectKeysFix from '../keys/fix.js';
// import symbolFix from '../symbol/fix.js';
import {toObject, toIterable, isEnumerable} from '/fix-helpers.js';

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
const fix = {
    dependencies: [
        objectKeysFix
        // symbolFix
    ],
    type: 'inline',
    value: function fixObjectAssign() {
        Object.assign = assign;
    }
};

export default fix;
