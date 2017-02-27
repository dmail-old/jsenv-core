import testObject from '../test.js';
import {at, present} from '/test-helpers.js';
const methodName = 'keys';
const test = {
    dependencies: [testObject],
    run: at(testObject.run, methodName),
    complete: present
};
export default test;
