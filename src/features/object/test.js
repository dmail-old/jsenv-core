import {at, present} from '/test-helpers.js';
const constructorName = 'Object';
const test = {
    run: at(constructorName),
    complete: present
};
export default test;
