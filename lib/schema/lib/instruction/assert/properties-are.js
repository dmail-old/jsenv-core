import AssertInstruction from '../instruction-assert.js';

const PropertiesAre = AssertInstruction.register('propertiesAre', {
    constructorSignature: [
        {
            name: '...properties',
            type: 'string',
            unique: true
            /* min: 1 */ // propertiesAre() is ok because it means : hasNoProperties()
        }
    ],

    metas: {
        "nameDifferences"(value) {
            const expectedPropertyNames = this.args;
            const valuePropertyNames = Object.keys(value);
            const differences = [];

            valuePropertyNames.forEach(function(name) {
                if (expectedPropertyNames.includes(name) === false) {
                    differences.push({
                        type: 'added',
                        name: name
                    });
                }
            });

            expectedPropertyNames.forEach(function(name) {
                if (valuePropertyNames.includes(name) === false) {
                    differences.push({
                        type: 'missing',
                        name: name
                    });
                }
            });

            return differences;
        }
    },

    assert() {
        return this.inputMeta.nameDifferences.length === 0;
    }
});

export default PropertiesAre;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
