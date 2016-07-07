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
                return this.createCombinedInstruction(instruction);
            }
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
        let combinedInstruction = combineInstruction(instruction, operator);
        combinedInstruction.list = this;
        // combinedInstruction.list = this;
        return combinedInstruction;
    },

    createPathedBranch(path) {
        // when you create a pathed branch for an instruction list, all its args instruction are pathed too
        let branch = InstructionList.super.createPathedBranch.call(this, path);

        // im' not sure on this, maybe it's only the behaviour of eachProperty because
        // the purpose of instructionList is to hold a list of instruction that may happen at different path
        // moreover changing the path of an instructionList already have an impact on it's subinstructions
        // (according to the fact mutationChild are created on mutation.input.value) in the getChildren method below
        // the decision is not final yet but for now I would say subinstruction must be runned on
        // the mutation.input.originalValue because they have their own path
        // and creating a pathedBranch instructionList should update the path of it's subintructions recursively as described
        // in the eachProperty.getChildren where the path is prepended on the subinstruction

        // branch.args = branch.args.map(function(instruction) {
        //     return instruction.createPathedBranch(path);
        // });

        branch.args = branch.args.map(function(combinedInstruction) {
            var branchPath = branch.path;
            var combinedInstructionPath = combinedInstruction.path;
            var combinedInstructionBranchPath;

            combinedInstructionBranchPath = branchPath.slice().concat(combinedInstructionPath);

            return combinedInstruction.createPathedBranch(combinedInstructionBranchPath);
        });

        return branch;
    },

    getChildren(mutation) {
        return this.args.map(function(combinedInstruction) {
            return combinedInstruction.createMutation(mutation.input.originalValue, mutation.options);
        }, this);
    },

    valueNotFoundHook() {
        // noop let each mutation children handle this
    },

    beforeHook(mutation) {
        InstructionList.super.beforeHook.apply(this, arguments);
        mutation.children = this.getChildren(mutation);
    },

    beforeEachHook(mutation, mutationChild, previousMutationChild) {
        if (previousMutationChild) {
            let operator = mutationChild.instruction.operator;
            if (operator === 'and') {
                if (previousMutationChild.output.isFalsy()) {
                    // console.log(
                    //     'shortcircuit',
                    //     compiledInstruction.stringify(),
                    //     'because previous',
                    //     previousCompiledInstruction.stringify(),
                    //     'is falsy'
                    // );
                    mutationChild.return(false, previousMutationChild);
                }
            } else if (operator === 'or') {
                if (previousMutationChild.output.isTruthy()) {
                    mutationChild.return(true, previousMutationChild);
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
            mutation.return(mutationLastChild.output.isTruthy(), mutationLastChild);
        } else {
            mutation.return(true);
        }
    },

    run(mutation) {
        let mutationChildren = mutation.children;
        let previousMutationChild;
        for (let mutationChild of mutationChildren) {
            this.beforeEachHook(mutation, mutationChild, previousMutationChild);
            mutationChild.exec();
            // console.log('exec', compiledInstruction.stringify(), 'output', compiledInstruction.output);
            this.afterEachHook(mutation, mutationChild, previousMutationChild);
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

    beforeEachHook(mutation, childMutation) {
        if (mutation.meta.truthyCount > 1) {
            // I'm not sure if compiledInstruction is shortcircuited by this oneOf instruction
            // because it's oneOf who owns the logic of "no more than one of my subinstruction must be truthy"
            // or if it's the subinstruction who was truthy
            // seems more logic to shortcircuit because of the oneOf
            childMutation.return(false, mutation);
        }
    },

    afterEachHook(mutation, childMutation) {
        // console.log('oneOf after', instruction.stringify(), instruction.isTruthy());
        // problem : the instruction is not yet settled bcoz of
        if (childMutation.isTruthy()) {
            mutation.meta.truthyCount++;
            console.log(childMutation.stringify(), 'is truthy, increasing truthyCount to', mutation.meta.truthyCount);
        } else {
            console.log('let truthyCount to', mutation.meta.truthyCount);
        }
    },

    afterHook(mutation) {
        // not really needed because the last instruction output could be used as instructionList does
        // yep BUT, this instruction is not mutated because the last instruction is truthy but
        // because of its internal logic, just like inbeforeEachHook
        var exactlyOneInstructionIsTruthy = mutation.meta.truthyCount === 1;

        mutation.return(exactlyOneInstructionIsTruthy);
    }
});

/*
EachPropertyInstruction will not be runned on value but rather on each value property
*/
const EachProperty = Instruction.extend('EachProperty', {
    constructorSignature: [
        {
            kind: 'instruction'
        }
    ],

    createMutation(...args) {
        return this.args[0].createMutation(...args);
    },

    getChildren(mutation) {
        var mutationPath = mutation.input.path;
        var index = mutationPath.length;

        // function insertPropertyNameIntoInstructionPath(instruction, propertyName) {
        //     // let path = instruction.path.slice();
        //     instruction.path.splice(index, 0, propertyName);

        //     if (InstructionList.isPrototypeOf(instruction) === false) {
        //         // console.log('update path of', instruction.stringify(), 'from', path, 'to', instruction.path);
        //     }
        // }

        // function insertPropertyNameIntoInstruction(instruction, propertyName) {
        //     insertPropertyNameIntoInstructionPath(instruction, propertyName);

        //     if (InstructionList.isPrototypeOf(instruction)) {
        //         instruction.args.forEach(function(instructionArg) {
        //             insertPropertyNameIntoInstruction(instructionArg, propertyName);
        //         });
        //     }
        // }

        // je crée une mutation à un path pour les instructions enfants
        // normalement il faudrais que les instructions enfants "hérite" de ce path
        // ce qui n'est pas le cas actuellement, ce n'est même pas le ca spour instruction list non plus
        // here we'll just have to create a pathedBranch before creating the mutated instruction
        // I don't get why I have to to path.split to insert the propertyName
        // (because child instruction may concern any path not especially a child property)

        return Object.keys(mutation.input.value).map(function(propertyName) {
            var propertyInstructionPath = mutation.instruction.path.slice();
            propertyInstructionPath.splice(index, 0, propertyName);

            var pathedPropertyInstruction = mutation.instruction.createPathedBranch({
                path: propertyInstructionPath
            });

            // no I do have my pathedPropertyInstruction I must recursively insert the propertyName into
            // desncendant instruction

            // and now return the corresponding mutation
            return pathedPropertyInstruction.createMutation(mutation.input.value, mutation.options);
        }, this);
    }
});

export {InstructionList, AllOf, AnyOf, OneOf, EachProperty};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        var equalsFoo = Instruction.extend('constantInstruction', {
            run(mutation) {
                return mutation.input.value === 'foo';
            }
        });

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
    }
};
