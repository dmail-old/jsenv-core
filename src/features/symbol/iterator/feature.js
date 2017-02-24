import {at} from 'helper/detect.js';
import parent from '../feature.js';

const path = 'iterator';
const feature = {
    dependencies: [parent],
    run: at(parent.run, path),
    test: parent.test,
    solution: parent.solution
};

export default feature;

