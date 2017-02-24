import {at, expect, present} from 'helper/detect.js';
import parent from '../../feature.js';

const path = 'prototype';
const feature = {
    dependencies: [parent],
    run: at(parent.run, path),
    test: expect(present)
};

export default feature;
