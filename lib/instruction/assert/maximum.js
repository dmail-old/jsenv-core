import AssertInstruction from '../instruction-assert.js';

var Maximum = AssertInstruction.register('maximum', {
    constructorSignature: [
        {type: 'number'},
        {name: 'exclusive', type: 'boolean', default: false}
    ],
    restriction: 'number',

    getMaximumValue() {
        let maximumValue = this.args[0];
        let exclusiveMaximum = this.args[1];

        if (exclusiveMaximum === true) {
            return maximumValue--;
        }

        return maximumValue;
    },

    assert(input) {
        let maximumValue = this.getMaximumValue();
        let isBelow = input >= maximumValue;

        return isBelow;
    }
});

export default Maximum;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
