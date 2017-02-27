import {at, present} from '/detect-helpers.js';
const constructorName = 'Object';
const detect = {
    run: at(constructorName),
    complete: present
};
export default detect;
