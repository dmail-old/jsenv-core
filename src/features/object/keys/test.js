import {at, present} from '/test-helpers.js';

const test = {
    run: at('Object', 'keys'),
    complete: present
};

export default test;
