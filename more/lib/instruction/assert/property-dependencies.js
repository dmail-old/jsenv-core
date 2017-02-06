import AssertInstruction from '../instruction-assert.js';
import safeHasProperty from '../../util/safe-has-property.js';

const PropertyDependencies = AssertInstruction.register('propertyDependencies', {
    constructorSignature: [
        {name: 'propertyName', type: 'string'},
        {name: '...dependencies', type: 'string', unique: true, min: 1}
    ],

    assert() {
        let dependency = this.args[1];
        let value = arguments[0];

        return safeHasProperty(value, dependency);
    }
});

PropertyDependencies.addSkipReason({
    name: 'has-property',
    method(instruction) {
        let propertyName = instruction.args[0];

        return safeHasProperty(instruction.input, propertyName);
    }
});

export default PropertyDependencies;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
