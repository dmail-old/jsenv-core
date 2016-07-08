import safeHasProperty from '../../util/safe-has-property.js';

import signatures from '../signatures.js';
import AssertInstruction from '../instruction-assert.js';

const HasProperty = AssertInstruction.register('hasProperty', {
    constructorSignature: signatures.oneString,

    assert() {
        let propertyName = this.args[0];
        let value = arguments[0];

        return safeHasProperty(value, propertyName);
    }
});

export default HasProperty;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
