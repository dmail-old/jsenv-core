import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const MinLength = AssertInstruction.register('minLength', {
    constructorSignature: signatures.oneNumber,
    restriction: 'string',

    metas: {
        'length'(input) {
            return input.length;
        }
    },

    assert() {
        let minLength = this.args[0];
        let lengthIsAbove = this.inputMetas.length >= minLength;

        return lengthIsAbove;
    }
});

export default MinLength;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
