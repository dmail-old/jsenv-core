import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

var MaxProperties = AssertInstruction.register('maxProperties', {
    constructorSignature: signatures.oneNumber,
    restriction: 'object',

    metas: {
        "propertiesLength"(value) {
            return Object.keys(value).length;
        }
    },

    assert() {
        return this.metas.propertiesLength <= this.args[0];
    }
});

export default MaxProperties;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
