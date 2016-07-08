import AssertInstruction from '../instruction-assert.js';

var Minimum = AssertInstruction.register('minimum', {
    constructorSignature: [
        {type: 'number'},
        {name: 'exclusive', type: 'boolean', default: false}
    ],
    restriction: 'number',

    getMinimumValue() {
        let minimumValue = this.args[0];
        let exclusiveMinimum = this.args[1];

        if (exclusiveMinimum === true) {
            minimumValue++;
        }

        return minimumValue;
    },

    assert(input) {
        let minimumValue = this.getMinimumValue();
        let isAbove = input >= minimumValue;

        return isAbove;
    }
});

export default Minimum;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
