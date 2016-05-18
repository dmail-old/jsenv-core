import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const Equals = AssertInstruction.register('equals', {
    constructorSignature: signatures.one,
    strict: true,

    assert() {
        let value = arguments[0];
        let expectedValue = this.args[0];

        if (this.strict) {
            if (expectedValue === value) {
                return true;
            }
        } else {
            if (expectedValue == value) { // eslint-disable-line eqeqeq, no-lonely-if
                return true;
            }
        }

        if (expectedValue === null || typeof expectedValue.equals !== 'function') {
            return false;
        }
        return expectedValue.equals(value);
    }
});

Equals.i18n.addTranslation(Equals.name, {
    "en": "{name} must be equal to {expected}",
    "en+not": "{name} must not be equal to {expected}"
});

export default Equals;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
