import {at, expect, present} from 'helper/detect.js';
import parent from '../feature.js';
import regExpFlagsDependency from '//regexp/prototype/flags/feature.js';
import iteratorSymbolDependency from '//symbol/iterator/feature.js';
const methodName = 'matchAll';
const feature = {
    dependencies: [parent, regExpFlagsDependency, iteratorSymbolDependency],
    run: at(parent.run, methodName),
    test: expect(present),
    solution: {
        type: 'corejs',
        value: 'es7.string.match-all'
    }
};
export default feature;
