import AssertInstruction from '../instruction-assert.js';
import safeHasProperty from '../../util/safe-has-property.js';

/*
function transformValueIntoGetter(defaultValue) {
    if (typeof defaultValue === 'function') {
        return defaultValue;
    }
    return function valueGetter() {
        return defaultValue;
    };
}
*/

function createGetterArgs(value) {
    return value instanceof Array ? value : [value];
}

/*
several way to define api for this instruction

// single call
api(
    [
        String,
        {},
        {kind: Function, default: createGetterArgs, dependencies: [1]}
    ],
    function() {

    }
);

// better
api.polymorph(
    [String, Function, {kind: Function, default: createGetterArgs}],
    function() {

    },

    [String, ],
    function() {

    }
);

// with the current impl of signature in instruction.js I don't see an easy way to do this
*/

const EnsurePropertyValue = AssertInstruction.register('ensurePropertyValue', {
    constructorSignature: [
        {name: 'propertyName', type: 'string'},
        {name: 'default'},
        {name: 'createDefaultGetterArgs', type: 'function', default: createGetterArgs}
    ],

    assert(input) {
        let propertyName = this.args[0];
        let defaultValue = this.args[1];
        let value;

        if (typeof defaultValue === 'function') {
            let createGetterArgs = this.args[2];
            let getterArgs = createGetterArgs.call(this, input);

            value = defaultValue.apply(this, getterArgs);
        } else {
            value = defaultValue;
        }

        input[propertyName] = value;

        return true;
    }
});

EnsurePropertyValue.addSkipReason({
    name: 'has-property',
    method(instruction) {
        return safeHasProperty(instruction.input, instruction.args[0]);
    }
});

export default EnsurePropertyValue;
