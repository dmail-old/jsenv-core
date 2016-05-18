import AssertInstruction from '../instruction-assert.js';

import listDuplicateValueKeys from '../../util/list-duplicate-value-keys.js';

var PropertyValueAreUnique = AssertInstruction.register('propertyValueAreUnique', {
    constructorSignature: [
        {name: 'propertyName', type: 'string'}
    ],

    metas: {
        "duplicateKeys"(value) {
            var propertyName = this.args[0];
            return listDuplicateValueKeys(value, function(first, second) {
                // only if first & second are objects else it could throw or return false duplicate
                return first[propertyName] == second[propertyName]; // eslint-disable-line eqeqeq
            });
        }
    },

    assert() {
        return this.metas.duplicateKeys.length === 0;
    }
});

export default PropertyValueAreUnique;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
