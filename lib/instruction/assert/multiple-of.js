import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const MultipleOf = AssertInstruction.register('multipleOf', {
    constructorSignature: signatures.oneNumber,
    restriction: 'number',

    assert(input) {
        let multipleOfValue = this.args[0];
        let modulo = input % multipleOfValue;
        let isMultipleOf = modulo === 0;

        return isMultipleOf;
    }
});

export default MultipleOf;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
