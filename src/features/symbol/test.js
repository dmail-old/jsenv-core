import {at, present} from 'helper/detect.js';

const test = {
    run: at('Symbol'),
    complete: present
};

export default test;
