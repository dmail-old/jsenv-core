import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const PartOf = AssertInstruction.register('partOf', {
    constructorSignature: signatures.one,
    restriction: 'object',

    assert() {
        const parfOfWhat = this.args[0];
        const value = arguments[0];
        const includesProperty = parfOfWhat.includes;

        if (typeof includesProperty === 'function') {
            return includesProperty.call(parfOfWhat, value);
        }
        return Object.keys(parfOfWhat).some(function(key) {
            return parfOfWhat[key] === value;
        });
    }
});

export default PartOf;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
