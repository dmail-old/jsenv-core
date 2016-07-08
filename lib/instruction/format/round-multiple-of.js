import signatures from '../signatures.js';
import FormatInstruction from '../instruction-format.js';

const RoundMultipleOf = FormatInstruction.register('roundMultipleOf', {
    constructorSignature: signatures.oneNumber,
    restriction: 'number',

    format(input) {
        let multipleOfValue = this.args[0];
        let modulo = input % multipleOfValue;
        let isMultipleOf = modulo === 0;

        if (isMultipleOf === false) {
            input = (input - modulo) + multipleOfValue;
        }

        return input;
    }
});

export default RoundMultipleOf;
