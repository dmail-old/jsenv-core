import Instruction from './instruction.js';

const InstructionList = Instruction.extend('InstructionList', {
    constructorSignature: [
        {
            name: '...instructions',
            kind: 'instruction'
        }
    ],
    defaultOperator: 'chain',

    createCombinedInstruction(instruction, operator) {
        if (this.args.length === 0) {
            operator = 'chain';
        } else if (arguments.length === 1) {
            operator = this.defaultOperator;
        }

        // console.log('combine', instruction.stringify(), 'with', operator);
        let combinedInstruction = instruction.combine(operator);
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
                    compiledInstruction.settleBy(previousCompiledInstruction, false);
                }
            } else if (compiledInstruction.operator === 'or') {
                if (previousCompiledInstruction.isTruthy()) {
                    console.log('shortcircuit', compiledInstruction.stringify(), 'because previous is truthy');
                    compiledInstruction.settleBy(previousCompiledInstruction, true);
                }
            }
        }
    },

    afterEach() {

    },

    after() {
        // console.log('after', this.stringify(), this.compiledList[this.compiledList.length - 1].stringify());
        let length = this.compiledList.length;

        if (length) {
            let lastInstruction = this.compiledList[length - 1];
            this.settleBy(lastInstruction, lastInstruction.isTruthy());
        } else {
            this.settle(true);
        }
    },

    run() {
        // console.log('eval list on', value);

        let previousInstruction;

        this.compiledList = [];

        let value = this.value;
        for (let instruction of this.args) {
            let compiledInstruction = instruction.compile(value, this.compileOptions);

            compiledInstruction.list = this;
            this.compiledList.push(compiledInstruction);

            this.beforeEach(compiledInstruction, previousInstruction);
            if (compiledInstruction.settled === false) {
                // console.log('exec', compiledInstruction.stringify(), 'output', compiledInstruction.output);
                compiledInstruction.eval();
            }
            this.afterEach(compiledInstruction, previousInstruction);

            previousInstruction = compiledInstruction;

            if (this.settled) {
                // console.log('break', this.stringify(), 'because settled');
                break;
            }
        }
    }
});

InstructionList.removeSkipReason('has-input'); // let subinstruction posssibly not concerning the same input be executed

export {InstructionList};

function registerInstructionList() {
    return InstructionList.register.apply(InstructionList, arguments);
}

const ExpectAtLeastOneInstructionSignature = InstructionList.constructorSignature.slice();
ExpectAtLeastOneInstructionSignature[0] = Object.assign({}, ExpectAtLeastOneInstructionSignature[0], {min: 1});

export const AllOf = registerInstructionList('allOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaulOperator: 'and',

    afterEach(compiledInstruction) {
        if (compiledInstruction.isFalsy()) {
            this.settleBy(compiledInstruction, false);
        }
    },

    after() {
        this.settle(true);
    }
});

export const AnyOf = registerInstructionList('anyOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaultOperator: 'or',

    afterEach(compiledInstruction) {
        // console.log('after', compiledInstruction.stringify(), compiledInstruction.output);

        if (compiledInstruction.isTruthy()) {
            this.settleBy(compiledInstruction, true);
            // console.log(this.stringify(), 'settled by', this.output, this.isTruthy(), compiledInstruction.input);
        }
    },

    after() {
        // console.log('setting', this.stringify(), 'to false');
        this.settle(false);
    }
});

export const OneOf = registerInstructionList('oneOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaultOperator: 'chain',

    before() {
        this.truthyCount = 0;
        // console.log('before', this.stringify(), 'truthy count to 0');
    },

    afterEach(compiledInstruction) {
        // console.log('oneOf after', instruction.stringify(), instruction.isTruthy());
        // problem : the instruction is not yet settled bcoz of
        if (compiledInstruction.isTruthy()) {
            this.truthyCount++;
            if (this.truthyCount > 1) {
                this.settleBy(compiledInstruction, false);
            }
            console.log(compiledInstruction.stringify(), 'is truthy, increasing truthyCount to', this.truthyCount);
        } else {
            console.log('let truthyCount to', this.truthyCount);
        }
    },

    after() {
        this.settle(this.truthyCount === 1);
    }
});

/*
EachPropertyInstruction will not be runned on value but rather on each value property
*/
// let compileCount = 0;
export const EachProperty = registerInstructionList('eachProperty', {
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
