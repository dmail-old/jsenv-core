import {expect, sameValues} from 'helper/detect.js';
import parent from '../feature.js';
const feature = {
    dependencies: [parent],
    run: parent.run,
    test: expect(function(stringIterator) {
        const string = '1234';
        const iterator = stringIterator.call(string);
        return sameValues(iterator, string);
    }),
    solution: parent.solution
};
export default feature;
