import {expect, sameValues} from 'helper/detect.js';
import parent from '../feature.js';
const feature = {
    dependencies: [parent],
    run: parent.run,
    test: expect(function(stringIterator) {
        const astralString = '𠮷𠮶';
        const iterator = stringIterator.call(astralString);
        return sameValues(iterator, astralString);
    }),
    solution: parent.solution
};
export default feature;
