import AssertInstruction from '../instruction-assert.js';

import listDuplicateValueKeys from '../../util/list-duplicate-value-keys.js';

var ValueAreUnique = AssertInstruction.register('valueAreUnique', {
    restriction: 'object',

    metas: {
        "duplicateKeys"(value) {
            return listDuplicateValueKeys(value);
        }
    },

    assert() {
        return this.metas.duplicateKeys.length === 0;
    }
});

export default ValueAreUnique;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
