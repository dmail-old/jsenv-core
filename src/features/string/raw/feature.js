import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';

const methodName = 'raw';
const feature = {
    dependencies: [parent],
    run: at(parent.run, methodName),
    test: expect(present),
    solution: {
        type: 'corejs',
        value: 'es6.string.raw'
    }
};

export default feature;
