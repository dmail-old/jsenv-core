import proto from 'proto';

import MacroInstruction from '../instruction-macro.js';

function isPrimitive(value) {
    return typeof value !== 'object';
}

function createMatchInstruction(value, path = []) {
    let operation = MacroInstruction.create();
    operation.setPath(path);

    // must be same kind
    let kind = operation.produce('kind', proto.kindOf(value));
    kind.setPath(path);
    operation.and(kind);

    if (isPrimitive(value)) {
        let equals = operation.produce('equals', value);
        equals.setPath(path);
        // and equals to value
        operation.and(equals);
    } else {
        let propertyNames = Object.keys(value);

        // and must have the property, and property must follow same instruction
        propertyNames.forEach(function(propertyName) {
            let hasProperty = operation.produce('hasProperty', propertyName);
            hasProperty.setPath(path);
            operation.and(hasProperty);

            let propertyValue = value[propertyName];
            let propertyPath = path.slice();
            propertyPath.push(propertyName);
            let matchProperty = createMatchInstruction(propertyValue, propertyPath);
            operation.and(matchProperty);
        }, this);
    }

    return operation;
}

const Match = MacroInstruction.register('match', {
    constructorSignature: [
        {name: 'model'}
    ],

    constructor(value) {
        return createMatchInstruction(value);
    }
});

export default Match;

export const test = {
    modules: ['node/assert'],

    suite(assert) {
        this.add("core", function() {
            /*
            function assertInstructionLike(macro, definition) {
                Object.keys(definition).forEach(function(instructionName, index) {
                    let instructionValue = definition[instructionName];
                    let instruction = macro.args[index];

                    assert.equal(instruction.name, instructionName);
                    assert.equal(instruction.args[0], instructionValue);
                });
            }
            */

            let match = Match.create({foo: 'bar'});

            assert.equal(match.args[0].name, 'kind');
            assert.equal(match.args[1].name, 'hasProperty');
            assert.equal(match.args[2].args[0].name, 'kind');
            assert.equal(match.args[2].args[1].name, 'equals');

            assert(match.run({foo: 'bar'}).isTruthy());
            assert(match.run({foo: 'bar', boo: true}).isTruthy());
            assert(match.run({foo: 'boo'}).isFalsy());
        });
    }
};
