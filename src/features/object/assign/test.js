import testObject from '../test.js';
import {at, present} from '/test-helpers.js';
const methodName = 'assign';
const test = {
    dependencies: [testObject],
    run: at(testObject.run, methodName),
    complete: present
};
export default test;
