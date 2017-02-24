import {expect, expectThrow} from 'helper/detect.js';
import parent from '../feature.js';
const feature = {
    dependencies: [parent],
    run: parent.run,
    test: expect(expectThrow(function(datePrototypeToISOString) {
        datePrototypeToISOString.call(NaN); // eslint-disable-line no-unused-expressions
    }))
};
export default feature;
