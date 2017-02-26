import {at, expect, present} from 'helper/detect.js';

const path = 'Object';
const feature = {
    run: at(path),
    test: expect(present)
};

export default feature;
