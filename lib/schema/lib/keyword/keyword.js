// http://weblogs.asp.net/ricardoperes/fluent-validation-in-javascript

import proto from 'proto';
import DependencyGraph from 'jsenv/dependency-graph';

import DefinitionError from './definition-error.js';

// import Instruction from '../instruction/index.js';

const Keyword = proto.extend('Keyword', {
    name: '',
    valueName: 'value',
    dependencies: [],
    requiredDependencies: [],
    args: [],
    instructionPrototype: undefined,

    constructor(value, dependencies) {
        this.args = [];

        this.args.push(value);
        dependencies.forEach(function(dependencyKeyword, index) {
            if (index in this.requiredDependencies && dependencyKeyword === this.dependencies[index]) {
                throw new DefinitionError('MISSING', this.name, dependencyKeyword.name);
            }
            this.args.push(dependencyKeyword);
        }, this);

        this.callHook('created');
    },

    toString() {
        return this.name;
    },

    get value() {
        return this.args[0];
    },

    set value(value) {
        this.args[0] = value;
    },

    get instructionArgs() {
        let args = this.args;
        let shouldPushValue;
        let instructionPrototype = this.instructionPrototype;
        let minInstructionConstructorLength = instructionPrototype.getMinArgumentLength();
        let instructionArgs = [];

        shouldPushValue = minInstructionConstructorLength !== 0;
        if (shouldPushValue) {
            instructionArgs.push(args[0]);
        }

        let i = 1;
        let j = args.length;
        for (; i < j; i++) {
            instructionArgs.push(args[i].value);
        }

        return instructionArgs;
    },

    createInstruction() {
        // console.log('creating instruction for', this);

        let InstructionPrototype = this.instructionPrototype;
        let instruction = InstructionPrototype.create.apply(InstructionPrototype, this.instructionArgs);

        return instruction;
    },

    callHook(name) {
        const hookName = name + 'Effect';

        if (hookName in this) {
            this[hookName](this);
        }
    }
});

// inactive keyword
(function() {
    Object.assign(Keyword, {
        inactiveReasons: [],

        addInactiveReason(inactiveReason) {
            if (this.hasOwnProperty('inactiveReasons') === false) {
                this.inactiveReasons = this.inactiveReasons.slice();
            }

            this.inactiveReasons.push(inactiveReason);
        },

        isActive() {
            for (let inactiveReason of this.inactiveReasons) {
                if (inactiveReason.check(this)) {
                    this.inactiveReason = inactiveReason;
                    return false;
                }
            }

            return true;
        },

        activeValue: undefined,
        disabled: false
    });

    Keyword.addInactiveReason({
        name: 'disabled',
        check(keyword) {
            return keyword.disabled === true;
        }
    });

    /*
    parameterkeywords influence other keywords behaviour but does not create any instruction
    */
    Keyword.addInactiveReason({
        name: 'is-parameter',
        check(keyword) {
            return Boolean(keyword.parameterOf);
        }
    });

    /*
    Before code threw error when an early keyword was defined, for instance {required: true}
    Because I was assuming that having required: true on root schema makes no sense
    however If we consider schema can be reused later or reinjected more deeply then we can consider
    that the keyword is juste disabled when defined too early
    */
    Keyword.addInactiveReason({
        name: 'too-early',
        check(keyword) {
            let requiredDepth = keyword.requiredDepth || 0;

            return requiredDepth && keyword.schema.depth < requiredDepth;
        }
    });

    Keyword.addInactiveReason({
        name: 'value-is-inactive',
        check(keyword) {
            return keyword.hasOwnProperty('activeValue') && keyword.value !== keyword.activeValue;
        }
    });
})();

Keyword.define({
    prototypes: [],
    prototypeDependencyGraph: DependencyGraph.create(),

    getPrototypesOrderedByDependency() {
        return this.prototypeDependencyGraph.sort();
    },

    // keyword must be created in a specific order (respecting dependency)
    getNameDefinitionOrder(keywordName) {
        return this.getPrototypesOrderedByDependency().findIndex(function(KeywordPrototype) {
            return KeywordPrototype.name === keywordName;
        });
    },

    compareNamesDefinitionOrder(a, b) {
        return this.getNameDefinitionOrder(a) - this.getNameDefinitionOrder(b);
    },

    addPrototype(Keyword) {
        this.prototypes.push(Keyword);
        this.prototypeDependencyGraph.register(Keyword, Keyword.dependencies);
    },

    register(name) {
        var args = ['Keyword' + name, {name: name}];
        args.push.apply(args, Array.prototype.slice.call(arguments, 1));

        const KeywordPrototype = this.extend.apply(this, args);

        // KeywordPrototype.instructionPrototype = Instruction.getPrototypeByName(KeywordPrototype.instructionName);

        this.addPrototype(KeywordPrototype);

        return KeywordPrototype;
    },

    findPrototypeByName(keywordName) {
        return this.prototypes.find(function(Keyword) {
            return Keyword.name === keywordName;
        });
    },

    getPrototypeByName(keywordName) {
        var Keyword = this.findPrototypeByName(keywordName);

        if (!Keyword) {
            throw new DefinitionError('UNKNOWN', keywordName);
        }

        return Keyword;
    },

    createKeyword(keywordName/* , keywordValue */) {
        const KeywordPrototype = this.getPrototypeByName(keywordName);
        return KeywordPrototype.create.apply(KeywordPrototype, Array.prototype.slice.call(arguments, 1));
    },

    addDependency(keywordPrototype) {
        // console.log(this.name, 'now dependent of', keywordPrototype.name);
        if (this.hasOwnProperty('dependencies') === false) {
            this.dependencies = this.dependencies.slice();
        }

        this.dependencies.push(keywordPrototype);
        this.prototypeDependencyGraph.register(this, this.dependencies); // update dependencies
    },

    addRequiredDependency(keywordPrototype) {
        this.addDependency(keywordPrototype);

        if (this.hasOwnProperty('requiredDependencies') === false) {
            this.requiredDependencies = this.requiredDependencies.slice();
        }
        this.requiredDependencies.push(this.dependencies.length - 1);
    },

    registerParameter(name, defaultValue) {
        let ParameterKeywordPrototype = this.register(name);

        ParameterKeywordPrototype.parameterOf = this.name;
        ParameterKeywordPrototype.addRequiredDependency(this);
        if (arguments.length > 1) {
            ParameterKeywordPrototype.args = [defaultValue];
            this.addDependency(ParameterKeywordPrototype);
        } else {
            this.addRequiredDependency(ParameterKeywordPrototype);
        }

        return ParameterKeywordPrototype;
    }
});

// Keyword.prototypeDependencyGraph.debug = true;

export default Keyword;
