import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const MinProperties = AssertInstruction.register('minProperties', {
    constructorSignature: signatures.oneNumber,
    restriction: 'object',

    metas: {
        "propertiesLength"(value) {
            return Object.keys(value).length;
        }
    },

    assert() {
        return this.metas.propertiesLength >= this.args[0];
    }
});

export default MinProperties;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
