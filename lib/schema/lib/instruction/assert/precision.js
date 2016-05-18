import getDecimalCount from '../../util/get-decimal-count.js';

import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const Precision = AssertInstruction.register('precision', {
    constructorSignature: signatures.oneNumber,
    restriction: 'number',

    assert(input) {
        let precision = this.args[0];

        return getDecimalCount(input) === getDecimalCount(precision);
    }
});

export default Precision;
