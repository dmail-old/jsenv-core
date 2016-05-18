import getDecimalCount from '../../util/get-decimal-count.js';

import signatures from '../signatures.js';
import FormatInstruction from '../instruction-format.js';

const Round = FormatInstruction.register('round', {
    constructorSignature: signatures.oneNumber,
    restriction: 'number',

    format(input) {
        let precision = this.args[0];

        if (precision < 1) {
            let decimalCount = getDecimalCount(precision);
            input = parseFloat(input.toFixed(decimalCount));
        } else if (precision === 1) {
            input = Math.round(input);
        } else {
            input = Math.round(input / precision) * precision;
        }

        return input;
    }
});

export default Round;
