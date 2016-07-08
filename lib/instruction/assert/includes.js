import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const Includes = AssertInstruction.register('includes', {
    constructorSignature: signatures.one,
    restriction: 'object',

    assert(input) {
        const valueThatMustBeIncluded = this.args[0];
        const includesProperty = input.includes;

        if (typeof includesProperty === 'function') {
            return includesProperty.call(input, valueThatMustBeIncluded);
        }
        return Object.keys(input).some(function(key) {
            return input[key] === valueThatMustBeIncluded;
        });
    }
});

Includes.i18n.addTranslation(Includes.name, {
    "en": "{name} must includes {expected}",
    "en+not": "{name} must not includes {expected}"
});

export default Includes;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
