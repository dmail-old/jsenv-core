import '/object/keys/fix.js';
import '/symbol/fix.js';

// import {toObject, toIterable, isEnumerable, fixProperty} from '/fix-helpers.js';

// const getOwnPropertySymbols = Object.getOwnPropertySymbols;
// function assign(target, source) { // eslint-disable-line no-unused-vars
//     var object = toObject(target);
//     var length = arguments.length;
//     var index = 1;
//     while (index < length) {
//         var sourceArg = toIterable(arguments[index]);
//         var keys = Object.keys(sourceArg);
//         if (getOwnPropertySymbols) {
//             keys.push.apply(keys, getOwnPropertySymbols(sourceArg));
//         }
//         var i = 0;
//         var j = keys.length;
//         while (i < j) {
//             let key = keys[i];
//             if (isEnumerable(sourceArg, key)) {
//                 object[key] = sourceArg[key];
//             }
//             i++;
//         }
//         index++;
//     }
//     return object;
// }
// const fix = {
//     type: 'inline',
//     value: fixProperty(Object, 'assign', assign)
// };

// export default fix;

const fix = {
    type: 'corejs',
    value: 'es6.object.assign'
};

export default fix;
