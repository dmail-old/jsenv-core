import proto from 'proto';

import Instruction from './instruction.js';
import {InstructionList, AnyOf, OneOf} from './instruction-list.js';

import './assert/index.js';
import './format/index.js';
import './macro/index.js';

const conflictListMethods = [
    Instruction,
    function() {
        // dont check conflict with previous when operation is an OR
        return this.operator === 'or' ? [] : [this];
    },
    InstructionList,
    function() {
        let list = [];

        this.args.forEach(function(arg) {
            list.push.apply(list, arg.logicalGenerator());
        });

        return list;
    },
    AnyOf,
    function() {
        return this.args.length === 0 ? this.args : this.args[0].logicalGenerator();
    },
    OneOf,
    function() {
        return this.args.length === 0 ? this.args : this.args[0].logicalGenerator();
    }
];
let i = 0;
let j = conflictListMethods.length;
for (;i < j; i++) {
    conflictListMethods[i].logicalGenerator = conflictListMethods[i + 1];
    i++;
}

const InstructionCombinationHandler = proto.extend('InstructionCombinationHandler', {
    instances: [],
    leftInstructionPrototype: null,
    rightInstructionPrototype: null,

    constructor() {

    },

    registerCombination(firstInstructionPrototype, secondInstructionPrototype, properties) {
        if (typeof properties === 'function') {
            properties = {
                detect: properties,
                name: properties.name
            };
        }

        let combinationHandler = this.extend(
            {
                leftInstructionPrototype: firstInstructionPrototype,
                rightInstructionPrototype: secondInstructionPrototype
            },
            properties
        );

        firstInstructionPrototype.addOwnCombinationHandler(combinationHandler);
        secondInstructionPrototype.addOwnCombinationHandler(combinationHandler);

        return combinationHandler;
    },

    extend() {
        let Proto = proto.extend.apply(this, arguments);
        this.instances.push(Proto);
        return Proto;
    },

    handle() {

    },

    respectOrder: false,
    check(instruction, otherInstruction) {
        let leftInstructionPrototype = this.leftInstructionPrototype;
        let rightInstructionPrototype = this.rightInstructionPrototype;
        let leftInstruction;
        let rightInstruction;
        let combinationDetected;
        let orderRespected = true;

        if (leftInstructionPrototype === rightInstructionPrototype) {
            leftInstruction = instruction;
            rightInstruction = otherInstruction;
            combinationDetected = true;
        } else if (leftInstructionPrototype.isPrototypeOf(instruction)) {
            leftInstruction = instruction;
            rightInstruction = otherInstruction;
            combinationDetected = rightInstructionPrototype.isPrototypeOf(otherInstruction);
        } else if (this.respectOrder === false && rightInstructionPrototype.isPrototypeOf(otherInstruction)) {
            leftInstruction = otherInstruction;
            rightInstruction = instruction;
            combinationDetected = leftInstructionPrototype.isPrototypeOf(instruction);
            orderRespected = false;
        } else {
            combinationDetected = false;
        }

        if (combinationDetected === false) {
            return false;
        }

        this.orderRespected = orderRespected;
        return this.handle(leftInstruction, rightInstruction);
    }
});

const CombinationSet = proto.extend('InstructionCombinationSet', {
    constructor(handlers) {
        this.list = handlers || [];
    },

    copy() {
        return CombinationSet.create(this.list.slice());
    },

    get(name) {
        if (InstructionCombinationHandler.isPrototypeOf(name)) {
            return name;
        }
        return InstructionCombinationHandler.instances.find(function(instructionCombinationHandler) {
            return instructionCombinationHandler.name === name;
        });
    },

    has(instructionCombinationHandler) {
        return this.list.indexOf(instructionCombinationHandler) > -1;
    },

    add(instructionCombinationHandler) {
        if (InstructionCombinationHandler.isPrototypeOf(instructionCombinationHandler) === false) {
            throw new TypeError(
                'CombinationSet add() method first argument must be a InstructionCombinationHandler (not ' +
                instructionCombinationHandler + ')'
            );
        }

        if (this.has(instructionCombinationHandler) === false) {
            this.list.push(instructionCombinationHandler);
        }
    },

    remove(instructionCombinationHandler) {
        let index = this.list.indexOf(instructionCombinationHandler);

        if (index > -1) {
            this.list.splice(index, 1);
        }
    },

    check(firstInstruction, secondInstruction) {
        let list = this.list;

        if (list.length) {
            let logicalInstructions = secondInstruction.logicalGenerator();

            for (let logicalInstruction of logicalInstructions) {
                for (let instructionCombinationHandler of list) {
                    instructionCombinationHandler.check(firstInstruction, logicalInstruction);
                }
            }
        }
    }
});

Instruction.define({
    combinationSet: CombinationSet.create(),

    markAsHavingOwnCombinationSet() {
        if (this.hasOwnProperty('combinationSet') === false) {
            this.combinationSet = this.combinationSet.copy();
        }
    },

    addOwnCombinationHandler(instructionCombinationHandler) {
        this.markAsHavingOwnCombinationSet();
        this.combinationSet.add(instructionCombinationHandler);
    },

    checkCombination(instruction) {
        return this.combinationSet.check(this, instruction);
    }
});

// conflict
function registerConflicts() {
    const InstructionConflictHandler = InstructionCombinationHandler.extend({
        detect() {
            return false;
        },

        handle(a, b) {
            if (this.detect(a, b)) {
                throw a.createError('CONFLICT', b);
            }
        }
    });

    function registerConflict(firstInstruction, secondInstruction, properties) {
        InstructionConflictHandler.registerCombination(firstInstruction, secondInstruction, properties);
    }

    function registerConflictByName(firstInstructionName, secondInstructionName, properties) {
        return registerConflict(
            Instruction.getPrototypeByName(firstInstructionName),
            Instruction.getPrototypeByName(secondInstructionName),
            properties
        );
    }

    // negation conflict actived by default
    registerConflict(Instruction, Instruction, function(a, b) {
        return b.isOppositeOf(a);
    });

    // type, kind, equal, multipleOf cannot coexist with the same instruction except if args[0] is the same
    ['kind', 'equals', 'multipleOf'].forEach(function(instructionName) {
        registerConflictByName(instructionName, instructionName, function(firstInstruction, secondInstruction) {
            return firstInstruction.args[0] !== secondInstruction.args[0];
        });
    });

    // above must not be > to below
    [
        ['minLength', 'maxLength'],
        ['minProperties', 'maxProperties']
    ].forEach(function(pair) {
        registerConflictByName(pair[0], pair[1], function(minInstruction, maxInstruction) {
            return minInstruction.args[0] > maxInstruction.args[0];
        });
    });

    const basicTypes = ['null', 'undefined', 'number', 'string', 'object', 'function', 'regexp'];
    registerConflictByName('cast', 'kind', function(cast, kind) {
        let kindValue = kind.args[0];

        // expecting kind: 'number' && cast: 'string' is impossible
        // but for other kind than basic types it may be possible
        // for instance kind: 'date' && cast: 'number' on {valueOf(){ return new Date(); }}
        if (basicTypes.includes(kindValue)) {
            let castValue = cast.args[0];
            if (castValue !== kindValue) {
                return true;
            }
        }
        return false;
    });

    // startsWithBlank() + trimLeft() -> will fail
    // startsWithBlank().not() + trimleft() -> ok
    [
        ['startsWithBlank', 'trimLeft'],
        ['endsWithBlank', 'trimRight'],
        ['includesMultipleBlank', 'trimMultiple']
    ].forEach(function(pair) {
        registerConflictByName(pair[0], pair[1], function(assertInstruction/* , formatInstruction */) {
            return assertInstruction.negated === false;
        });
    });

    // below & above

    // take into account exclusiveMaximum & exclusiveMinimum
    registerConflictByName('minimum', 'maximum', function(minimum, maximum) {
        let minimumValue = minimum.getMinimumValue();
        let maximumValue = maximum.getMaximumValue();

        return minimumValue > maximumValue;
    });
    ['minimum', 'maximum'].forEach(function(instructionName) {
        // must be multipleOf the multipleOf instruction
        registerConflictByName(instructionName, 'multipleOf', function(numberLimit, multipleOf) {
            return multipleOf.eval(numberLimit.args[0]);
        });

        // must use same precision as precision instruction
        registerConflictByName(instructionName, 'precision', function(numberLimit, precision) {
            return precision.eval(numberLimit.args[0]);
        });
    });

    ['padLeft', 'padRight', 'pad'].forEach(function(instructionName) {
        // padLeft, padRight & pad char length must be < lengthBelow
        registerConflictByName(instructionName, 'maxLength', function(padInstruction, maxLength) {
            return maxLength.eval(padInstruction.args[2]);
        });
    });
}

// warning
function registerWarnings() {
    const UselessInstructionCombinationHandler = InstructionCombinationHandler.extend({
        respectOrder: true,

        detect() {
            return false;
        },

        handle(a, b) {
            if (this.detect(a, b)) {
                console.warn('instruction ' + a + ' makes instruction' + b + 'useless');
                // we could do b.settleBy(a)
            }
        }
    });

    function registerUselessCombinationByName(firstInstructionName, secondInstructionName, properties) {
        UselessInstructionCombinationHandler.registerCombination(
            Instruction.getPrototypeByName(firstInstructionName),
            Instruction.getPrototypeByName(secondInstructionName),
            properties
        );
    }

    registerUselessCombinationByName('trimLeft', 'startsWithBlank', function(trimLeft, startsWithBlank) {
        return startsWithBlank.negated === true;
    });

    registerUselessCombinationByName('kind', 'kind', function(previousKind, kind) {
        return previousKind.args[0] !== kind.args[0];
    });
}

/*
BEWARE : do not reactivate until the following is fixed
currently asserting {kind: 'string', {not: {kind: 'number'}}} would throw considering
we're trying to do kind:string & kind:number ignoring the fast kind:number is inside a not()
two possibility: not() may negate every children or we could ignore the not() branch in logicalGenerator()
*/
let combinationEffectActivated = false;
if (combinationEffectActivated) {
    let oldSetInstruction = InstructionList.setInstruction;
    InstructionList.define({
        combinationEffectActivated: true,

        checkCombination(instruction) {
            let args = this.args;
            let index = args.length;

            if (index > 0) {
                while (index--) {
                    let previousInstruction = args[index];
                    previousInstruction.checkCombination(instruction);
                }
            }
        },

        // it would not be in the add because there is no add atm, we must find an other way
        setInstruction(combinedInstruction) {
            if (this.combinationEffectActivated) {
                this.checkCombination(combinedInstruction);
            }

            return oldSetInstruction.apply(this, arguments);
        }
    });

    registerConflicts();
    registerWarnings();
}

export const test = {
    modules: ['node/assert'],

    suite() {
        /*
        this.add("auto detection of instruction conflict", function() {
            function assertConflict(callback) {
                assert.throws(
                    callback,
                    function(e) {
                        return e.name == 'InstructionError' && e.code == 'CONFLICT';
                    }
                );
            }

            function assertNoConflict(callback) {
                assert.doesNotThrow(
                    callback
                );
            }

            this.add("negation", function() {
                this.add("and", function() {
                    assertConflict(
                        function() {
                            macro(isString).and(isString.not());
                        }
                    );
                });

                this.add("or", function() {
                    assertNoConflict(
                        function() {
                            macro(isString).or(isString.not());
                        }
                    );
                });

                this.add("allOf", function() {
                    assertConflict(
                        function() {
                            macro().allOf(isString, isString.not());
                        }
                    );
                });

                this.add("allOf + and", function() {
                    assertConflict(
                        function(){
                            macro().allOf(isString).and(isString.not());
                        }
                    );
                });

                this.add("anyOf", function() {
                    assertNoConflict(
                        function() {
                            macro().anyOf(isString, isString.not());
                        }
                    );
                });

                this.add("anyOf + and", function() {
                    assertConflict(
                        function() {
                            macro().anyOf(isString).and(isString.not());
                        }
                    );
                });
            });

            this.add("once", function() {
                let InstructionThatMustAppearOncePerLogicalChain = Instruction.extend();

                Instruction.registerConflictBetween(
                    InstructionThatMustAppearOncePerLogicalChain,
                    InstructionThatMustAppearOncePerLogicalChain,
                    function(a, b) {
                        return false === b.sameArguments(a);
                    }
                );

                let first = InstructionThatMustAppearOncePerLogicalChain.create('foo');
                let firstPeerBar = InstructionThatMustAppearOncePerLogicalChain.create('bar');
                let firstPeerFoo = InstructionThatMustAppearOncePerLogicalChain.create('foo');

                assertConflict(
                    function() {
                        macro(first, firstPeerBar);
                    }
                );

                assertNoConflict(
                    function() {
                        macro(first, firstPeerFoo);
                    }
                );
            });

            this.add("pair", function() {
                let InstructionA = Instruction.extend();
                let InstructionB = Instruction.extend();

                Instruction.registerConflictBetween(InstructionA, InstructionB, function(a, b) {
                    return a.args[0] < b.args[0];
                });

                assertConflict(
                    function() {
                        let insA = InstructionA.create(5);
                        let insB = InstructionB.create(10);

                        macro(insA, insB);
                    }
                );

                assertNoConflict(
                    function() {
                        let insA = InstructionA.create(10);
                        let insB = InstructionB.create(5);

                        macro(insA, insB);
                    }
                );
            });
        });
        */
    }
};
