import {at, present} from '/helper/detect.js';
const constructorName = 'Object';
const test = {
    run: at(constructorName),
    complete: present
};
export {test};

import {none} from '/helper/fix.js';
const solution = none();
export {solution};
