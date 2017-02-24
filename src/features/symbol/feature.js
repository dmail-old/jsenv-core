import {at, expect, present} from 'helper/detect.js';

const path = 'Symbol';
const feature = {
    run: at(path),
    test: expect(present),
    solution: {
        type: 'corejs',
        value: 'es6.symbol'
    }
};

export default feature;
