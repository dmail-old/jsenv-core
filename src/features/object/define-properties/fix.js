const fix = {
    type: 'corejs',
    value: 'es6.object.define-properties'
};

export default fix;

// import '/object/keys/fix.js';
// import 'object/define-property/fix.js';

// import {assertObject} from '/fix-helpers.js';
// function defineProperties(object, properties) {
//     assertObject(object);
//     const names = Object.keys(object);
//     let i = 0;
//     const j = names.length;
//     while (i < j) {
//         let name = names[i];
//         Object.defineProperty(object, name, properties[name]);
//         i++;
//     }
//     return object;
// }
