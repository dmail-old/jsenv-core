import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const MaxLength = AssertInstruction.register('maxLength', {
    constructorSignature: signatures.oneNumber,
    restriction: 'string',

    metas: {
        'length'(input) {
            return input.length;
        }
    },

    assert() {
        let maxLength = this.args[0];
        let lengthIsBelow = this.inputMetas.length <= maxLength;

        return lengthIsBelow;
    }
});

export default MaxLength;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
