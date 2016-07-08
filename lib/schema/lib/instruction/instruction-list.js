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

const InstructionList = Instruction.extend('InstructionList', {
    constructorSignature: [
        {
            name: '...instructions',
            kind: 'instruction',
            postTransform(instruction) {
                // all instruction are duplicated and an operator is set on them
                // to know how to combine them
                let combinedInstruction = this.createCombinedInstruction(instruction);
                this.instructionAddedHook(combinedInstruction);
                return combinedInstruction;
            }
        }
    ],
    defaultOperator: 'chain',

    instructionAddedHook(combinedInstruction) {
        return combinedInstruction;
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

    add(...args) {
        let combinedInstruction = this.createCombinedInstruction(...args);
        this.instructionAddedHook(combinedInstruction);
        return this.args.push(combinedInstruction);
    },

    getChildren() {
        return this.args;
    },

    createMutationChildren(mutation, instructionChildren) {
        return instructionChildren.map(function(instructionChild) {
            return instructionChild.createMutation(mutation.input.originalValue, mutation.options);
        }, this);
    },

    valueNotFoundHook() {
        // noop let each mutation children handle this
    },

    beforeHook(mutation) {
        InstructionList.super.beforeHook.apply(this, arguments);
        mutation.children = this.createMutationChildren(mutation, this.getChildren(mutation));
    },

    beforeEachHook(mutation, mutationChild, previousMutationChild) {
        if (previousMutationChild) {
            let operator = mutationChild.instruction.operator;
            if (operator === 'and') {
                if (previousMutationChild.output.isFalsy()) {
                    // console.log(
                    //     'shortcircuit',
                    //     mutationChild.instruction.stringify(),
                    //     'because previous',
                    //     previousMutationChild.instruction.stringify(),
                    //     'is falsy'
                    // );
                    mutationChild.eval(false, previousMutationChild);
                }
            } else if (operator === 'or') {
                if (previousMutationChild.output.isTruthy()) {
                    mutationChild.eval(true, previousMutationChild);
                }
            }
        }
    },

    afterEachHook() {

    },

    afterHook(mutation) {
        let mutationChildren = mutation.children;
        let length = mutationChildren.length;
        let mutationLastChild;

        if (length) {
            mutationLastChild = mutationChildren[length - 1];
        }

        // console.log('after', this.stringify(), lastInstruction.stringify());

        if (mutationLastChild) {
            mutation.eval(mutationLastChild.output.isTruthy(), mutationLastChild);
        } else {
            mutation.eval(true);
        }
    },

    run(mutation) {
        let mutationChildren = mutation.children;
        let previousMutationChild;
        for (let mutationChild of mutationChildren) {
            this.beforeEachHook(mutation, mutationChild, previousMutationChild);
            if (mutation.isMutated()) {
                break;
            }
            mutationChild.exec();
            if (mutation.isMutated()) {
                break;
            }
            // console.log('exec', compiledInstruction.stringify(), 'output', compiledInstruction.output);
            this.afterEachHook(mutation, mutationChild, previousMutationChild);
            if (mutation.isMutated()) {
                break;
            }
            previousMutationChild = mutationChild;
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
    defaulOperator: 'and'
});

const AnyOf = registerInstructionList('anyOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaultOperator: 'or'
});

const OneOf = registerInstructionList('oneOf', {
    constructorSignature: ExpectAtLeastOneInstructionSignature,
    defaultOperator: 'chain',

    beforeHook(mutation) {
        OneOf.super.beforeHook.apply(this, arguments);
        mutation.meta.truthyCount = 0;
    },

    // beforeEachHook(mutation, mutationChild) {
    //     // if (mutation.meta.truthyCount > 1) {
    //     //     // I'm not sure if compiledInstruction is shortcircuited by this oneOf instruction
    //     //     // because it's oneOf who owns the logic of "no more than one of my subinstruction must be truthy"
    //     //     // or if it's the subinstruction who was truthy
    //     //     // seems more logic to shortcircuit because of the oneOf
    //     //     childMutation.complete(false, mutation);
    //     // }
    //     return mutationChild;
    // },

    afterEachHook(mutation, mutationChild) {
        // console.log('oneOf after', instruction.stringify(), instruction.isTruthy());
        // problem : the instruction is not yet settled bcoz of
        if (mutationChild.output.isTruthy()) {
            mutation.meta.truthyCount++;
            if (mutation.meta.truthyCount > 1) {
                mutation.eval(false, mutationChild);
            }
            // console.log(
            //     mutationChild.instruction.stringify(),
            //     'is truthy, increasing truthyCount to',
            //     mutation.meta.truthyCount
            // );
        } else {
            // console.log('let truthyCount to', mutation.meta.truthyCount);
        }
    },

    afterHook(mutation) {
        // not really needed because the last instruction output could be used as instructionList does
        // yep BUT, this instruction is not mutated because the last instruction is truthy but
        // because of its internal logic, just like inbeforeEachHook
        var exactlyOneInstructionIsTruthy = mutation.meta.truthyCount === 1;

        mutation.eval(exactlyOneInstructionIsTruthy);
    }
});

/*
EachPropertyInstruction will not be runned on value but rather on each value property
*/
const EachProperty = registerInstructionList('eachProperty', {
    constructorSignature: [
        {
            kind: 'instruction'
        }
    ],

    // createMutation(...args) {
    //     return this.args[0].createMutation(...args);
    // },

    getChildren(mutation) {
        var instruction = this.args[0];

        return Object.keys(mutation.input.value).map(function(propertyName) {
            return instruction.createPathedBranch([propertyName]);
        });
    }
});

export {InstructionList, AllOf, AnyOf, OneOf, EachProperty};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        var equals = Instruction.extend('equals', {
            constructorSignature: [{}],
            run(mutation) {
                mutation.eval(mutation.input.value === this.args[0]);
            }
        });
        var equalsFoo = equals.create('foo');
        var equalsBar = equals.create('bar');

        this.add('', function() {
            var equalsFooTwice = InstructionList.create(
                equalsFoo,
                equalsFoo
            );

            assert.equal(equalsFooTwice.args[0].operator, 'chain');

            var mutation = equalsFooTwice.exec('foo');
            var mutationChildren = mutation.children;

            assert.equal(mutation.output.value, true);
            // children have mutated because of combined trueConstantInstruction (operator is chain)
            // if operator was or, the second mutation would mutate because of the previousOn being true
            assert.equal(mutationChildren[0].origin, equalsFooTwice.args[0]);
            assert.equal(mutationChildren[1].origin, equalsFooTwice.args[1]);

            var nameEqualsFooTwice = equalsFooTwice.createPathedBranch(['name']);
            assert.deepEqual(nameEqualsFooTwice.args[0].path, ['name']); // list pathed branch update their instruction path
            assert.equal(nameEqualsFooTwice.eval({name: 'foo'}), true);
        });

        this.add('and shorcircuit', function() {
            var equalsFooAndEqualsBar = InstructionList.create(equalsFoo);
            equalsFooAndEqualsBar.add(equalsBar, 'and');

            var mutation = equalsFooAndEqualsBar.exec('bar');

            assert.equal(mutation.output.value, false);
            // equals bar has mutated because of equals foo failure, and his considerer as false
            assert.equal(mutation.children[1].origin, mutation.children[0]);
            assert.equal(mutation.children[1].output.value, false);
        });

        this.add('or shortcircuit', function() {
            var equalsFooOrEqualsBar = InstructionList.create(equalsFoo);
            equalsFooOrEqualsBar.add(equalsBar, 'or');

            var mutation = equalsFooOrEqualsBar.exec('foo');

            assert.equal(mutation.output.value, true);
            // equals bar has mutated because of equals foo success, and his considered as true
            assert.equal(mutation.children[1].origin, mutation.children[0]);
            assert.equal(mutation.children[1].output.value, true);
        });

        this.add('oneOf', function() {
            var oneOfFooAndBar = OneOf.create(equalsFoo, equalsBar);
            assert.equal(oneOfFooAndBar.eval('foo'), true);
            assert.equal(oneOfFooAndBar.eval('hello'), false);

            var oneOfFooAndFoo = OneOf.create(equalsFoo, equalsFoo);
            var mutation = oneOfFooAndFoo.exec('foo');

            assert.equal(mutation.output.value, false);
            assert.equal(mutation.meta.truthyCount, 2);
            assert.equal(mutation.origin, mutation.children[1]);
        });

        this.add('eachProperty', function() {
            var eachPropertyEqualsBar = EachProperty.create(equalsBar);

            assert.equal(eachPropertyEqualsBar.eval({foo: 'bar'}), true);
            assert.equal(eachPropertyEqualsBar.eval({foo: 'foo'}), false);

            var nameEqualsFoo = equalsFoo.createPathedBranch(['name']);
            var eachPropertyNameEqualsFoo = EachProperty.create(nameEqualsFoo);

            assert.equal(eachPropertyNameEqualsFoo.eval([{name: 'foo'}]), true);
            assert.equal(eachPropertyNameEqualsFoo.eval([{name: 'bar'}]), false);

            var firstNameEqualsFoo = equalsFoo.createPathedBranch(['name', 'first']);
            var eachPropertyfirstNameEqualsFoo = EachProperty.create(firstNameEqualsFoo);
            assert.equal(eachPropertyfirstNameEqualsFoo.eval([{name: {first: 'foo'}}]), true);
        });

        return assert;
    }
};
