// import proto from 'env/proto';

import Instruction from './instruction.js';

var combineInstruction = (function() {
    function findPrototype(instruction, fn, bind) {
        while (instruction) {
            if (fn.call(bind, instruction) === true) {
                break;
            }
            if (instruction === Instruction) {
                break;
            }
            instruction = Object.getPrototypeOf(instruction);
        }

        return instruction;
    }

    function getPurestForm(instruction) {
        // get first prototype without operator property
        // meaning the instruction purest form: not yet extended by compile() or chain()
        return findPrototype(instruction, function(inst) {
            // we could also just check that upper prototype is Instruction or other strategy
            return inst.hasOwnProperty('operator') === false;
        });
    }

    return function combine(instruction, operator) {
        let pureInstruction = getPurestForm(instruction);
        let combinedInstruction = pureInstruction.extend();

        combinedInstruction.operator = operator;

        return combinedInstruction;
    };
})();

Instruction.define({
    isTruthy() {
        return Boolean(this.output);
    },

    isFalsy() {
        return Boolean(this.output) === false;
    },

    shortCircuit(compiledInstruction, output) {
        console.log('shortcircuit', this.stringify(), 'to', output, 'because of', compiledInstruction.stringify());
        this.shortCircuitedBy = compiledInstruction;
        this.return(output);
    }
});

const InstructionList = Instruction.extend('InstructionList', {
    constructorSignature: [
        {
            name: '...instructions',
            kind: 'instruction'
        }
    ],
    defaultOperator: 'chain',

    missingInputHook() {
        // noop let each subinstruction handle this
    },

    createCombinedInstruction(instruction, operator) {
        if (this.args.length === 0) {
            operator = 'chain';
        } else if (arguments.length === 1) {
            operator = this.defaultOperator;
        }

        // console.log('combine', instruction.stringify(), 'with', operator);
        let combinedInstruction = combineInstruction(instruction, operator);
        combinedInstruction.list = this;
        // combinedInstruction.list = this;
        return combinedInstruction;
    },

    setInstruction(combinedInstruction, index) {
        // should we throw once compiled ??
        this.args[index] = combinedInstruction;
    },

    setArgument(value, index) {
        InstructionList.super.setArgument.apply(this, arguments);
        this.setInstruction(this.createCombinedInstruction(this.args[index]), index);
    },

    before() {

    },

    beforeEach(compiledInstruction, previousCompiledInstruction) {
        if (previousCompiledInstruction) {
            if (compiledInstruction.operator === 'and') {
                if (previousCompiledInstruction.isFalsy()) {
                    console.log(
                        'shortcircuit',
                        compiledInstruction.stringify(),
                        'because previous',
                        previousCompiledInstruction.stringify(),
                        'is falsy'
                    );
                    compiledInstruction.shortCircuit(previousCompiledInstruction, false);
                }
            } else if (compiledInstruction.operator === 'or') {
                if (previousCompiledInstruction.isTruthy()) {
                    compiledInstruction.shortCircuit(previousCompiledInstruction, true);
                }
            }
        }
    },

    afterEach() {

    },

    after() {
        let compiledInstructions = this.compiledInstructions;
        let length = compiledInstructions.length;
        let lastInstruction;

        if (length) {
            lastInstruction = compiledInstructions[length - 1];
        }

        console.log('after', this.stringify(), lastInstruction.stringify());

        if (lastInstruction) {
            this.return(lastInstruction.isTruthy());
        } else {
            this.return(true);
        }
    },

    run() {
        this.compiledInstructions = [];

        let value = this.value;
        let previousInstruction;
        for (let combinedInstruction of this.args) {
            let compiledInstruction = combinedInstruction.compile(value, this.compiledOptions);
            this.compiledInstructions.push(compiledInstruction);

            this.beforeEach(compiledInstruction, previousInstruction);
            compiledInstruction.exec();
            // console.log('exec', compiledInstruction.stringify(), 'output', compiledInstruction.output);
            this.afterEach(compiledInstruction, previousInstruction);

            previousInstruction = compiledInstruction;
        }
    }
});

function registerInstructionList(...args) {
    return InstructionList.extend(...args);
    // InstructionList.register.apply(InstructionList, arguments);
}

const ExpectAtLeastOneInstructionSignature = InstructionList.constructorSignature.slice();
ExpectAtLeastOneInstructionSignature[0] = Object.assign({}, ExpectAtLeastOneInstructionSignature[0], {min: 1});

const AllOf = registerInstructionList('allOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaulOperator: 'and',

    after() {
        var everyInstructionIsTruthy = this.compiledInstructions.every(function(compiledInstruction) {
            return compiledInstruction.isTruthy();
        });

        this.return(everyInstructionIsTruthy);
    }
});

const AnyOf = registerInstructionList('anyOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaultOperator: 'or',

    after() {
        var someInstructionIsTruthy = this.compiledInstructions.some(function(compiledInstruction) {
            return compiledInstruction.isTruthy();
        });
        this.return(someInstructionIsTruthy);
    }
});

const OneOf = registerInstructionList('oneOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaultOperator: 'chain',

    before() {
        this.truthyCount = 0;
    },

    beforeEach(compiledInstruction) {
        if (this.truthyCount > 1) {
            compiledInstruction.skip({
                reason: 'more than one instruction have already matched'
            });
        }
    },

    afterEach(compiledInstruction) {
        // console.log('oneOf after', instruction.stringify(), instruction.isTruthy());
        // problem : the instruction is not yet settled bcoz of
        if (compiledInstruction.isTruthy()) {
            this.truthyCount++;
            console.log(compiledInstruction.stringify(), 'is truthy, increasing truthyCount to', this.truthyCount);
        } else {
            console.log('let truthyCount to', this.truthyCount);
        }
    },

    after() {
        var exactlyOneInstructionIsTruthy = this.truthyCount === 1;

        this.return(exactlyOneInstructionIsTruthy);
    }
});

/*
EachPropertyInstruction will not be runned on value but rather on each value property
*/
// let compileCount = 0;
const EachProperty = registerInstructionList('eachProperty', {
    constructorSignature: [
        {kind: 'instruction'}
    ],

    compile() {
        let instructionModel = this.args[0];
        let compiled = EachProperty.super.compile.apply(this, arguments);
        let index = this.path.length;

        instructionModel.setPath(this.path);

        // console.log('compile each property on', this.path);

        function insertPropertyNameIntoInstructionPath(instruction, propertyName) {
            // let path = instruction.path.slice();
            instruction.path.splice(index, 0, propertyName);

            if (InstructionList.isPrototypeOf(instruction) === false) {
                // console.log('update path of', instruction.stringify(), 'from', path, 'to', instruction.path);
            }
        }

        function insertPropertyNameIntoInstruction(instruction, propertyName) {
            insertPropertyNameIntoInstructionPath(instruction, propertyName);

            if (InstructionList.isPrototypeOf(instruction)) {
                instruction.args.forEach(function(instructionArg) {
                    insertPropertyNameIntoInstruction(instructionArg, propertyName);
                });
            }
        }

        compiled.args = Object.keys(compiled.input).map(function(propertyName) {
            let copy = instructionModel.copy(true);

            insertPropertyNameIntoInstruction(copy, propertyName);

            return copy;
        });

        return compiled;
    }
});

export {InstructionList, AllOf, AnyOf, OneOf, EachProperty};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('', function() {
            var trueConstantInstruction = Instruction.extend('constantInstruction', {
                run() {
                    return true;
                }
            });

            var list = InstructionList.create(
                trueConstantInstruction.create(),
                trueConstantInstruction.create()
            );
            var compiledList = list.compile(null);
            compiledList.exec();
            var compiledInstructions = compiledList.compiledInstructions;

            assert.equal(compiledList.output, true);
            assert.equal(compiledInstructions[1].shortCircuitedBy === undefined); // because of chain operator
            // with an or operator it would be shortcircuited by the previous
            // with and and no change
            // to be tested
        });
    }
};
