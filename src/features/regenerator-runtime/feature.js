import {at, present} from 'helper/detect.js';
const objectName = 'regeneratorRuntime';
const test = {
    run: at(objectName),
    complete: present
};
export {test};

const solution = {
    type: 'file',
    value: '${rootFolder}/node_modules/regenerator-runtime/runtime.js'
};
export {solution};
