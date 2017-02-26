import {at, present} from '/helper/detect.js';
import {test as objectTest} from '../feature.js';

const objectName = 'prototype';
const test = {
    dependencies: [objectTest],
    run: at(objectTest.run, objectName),
    complete: present
};
export {test};

import {none} from '/helper/fix.js';
const solution = none();
export {solution};
