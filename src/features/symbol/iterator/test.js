import {at, presence} from '/test-helpers.js';

const test = {
    run: at('Symbol', 'iterator'),
    complete: presence
};

export default test;

