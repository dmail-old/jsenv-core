import AssertInstruction from '../instruction-assert.js';

const EqualsOneOf = AssertInstruction.register('equalsOneOf', {
    constructorSchema: [
        {name: '...values', unique: true}
    ],

    assert(input) {
        return this.args.find(function(expectedValue) {
            return input === expectedValue;
        });
    }
});

export default EqualsOneOf;
