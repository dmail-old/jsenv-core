import {at, present} from '/test-helpers.js';

const test = {
    run: at('Date', 'now'),
    complete: present
};

export default test;
