import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
import symbolIteratorDependency from '//symbol/iterator/feature.js';
const feature = {
    dependencies: [parent, symbolIteratorDependency],
    run: at(parent.run, symbolIteratorDependency.run),
    test: expect(present),
    solution: {
        type: 'corejs',
        value: 'es6.string.iterator'
    }
};
export default feature;
