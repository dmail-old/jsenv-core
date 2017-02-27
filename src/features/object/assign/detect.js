import detectObject from '../detect.js';
import {at, present} from '/detect-helpers.js';
const methodName = 'assign';
const detect = {
    dependencies: [detectObject],
    run: at(detectObject.run, methodName),
    complete: present
};
export default detect;
