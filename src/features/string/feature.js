import {at, expect, present} from 'helper/detect.js';

const path = 'String';
const feature = {
    run: at(path),
    test: expect(present)
};

export default feature;
