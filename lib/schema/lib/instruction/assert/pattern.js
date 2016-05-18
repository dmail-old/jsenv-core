import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const Pattern = AssertInstruction.register('pattern', {
    constructorSignature: signatures.oneRegExp,
    restriction: 'string',

    assert() {
        let pattern = this.args[0];
        let value = arguments[0];

        return pattern.test(value);
    }
});

export default Pattern;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
