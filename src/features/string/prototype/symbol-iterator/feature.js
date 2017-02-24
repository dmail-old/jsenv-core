import {at, expect, present} from 'helper/detect.js';
import parent from '../../feature.js';
import symbolIterator from '//symbol/iterator/feature.js';

const feature = {
    dependencies: [parent],
    run: at(parent.run, symbolIterator.run),
    test: expect(present),
    solution: {
        type: 'corejs',
        value: 'es6.string.iterator'
    }
};

export default feature;
