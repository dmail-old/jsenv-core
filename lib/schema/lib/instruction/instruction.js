/*

double linked list : http://www.thatjsdude.com/interview/linkedList.html

it's more an expression than an instruction

*/

import proto from 'env/proto';
// import Item from 'env/item';

import InstructionError from './instruction-error.js';

import safeHasProperty from '../util/safe-has-property.js';
import listDuplicateValueKeys from '../util/list-duplicate-value-keys.js';

const Instruction = proto.extend('Instruction', {
    constructorSignature: [],

    constructor() {
        this.args = [];
        this.setArguments(Array.slice(arguments));
    },

    createError(code) {
        let args = [code, this];
        let i = 1;
        let j = arguments.length;

        for (;i < j; i++) {
            args[i + 1] = arguments[i];
        }

        return proto.create.apply(InstructionError, args);
    },

    getArgumentSignature(index) {
        let signature = this.constructorSignature;
        let length = signature.length;
        let argumentSignature;

        if (index < length) {
            argumentSignature = signature[index];
        } else {
            let lastArgumentSignature = this.getLastArgumentSignature();
            if (this.isRestArgumentSignature(lastArgumentSignature)) {
                argumentSignature = lastArgumentSignature;
            }
        }

        return argumentSignature;
    },

    setArgument(value, index) {
        // const signature = this.constructorSignature;
        let argumentSignature = this.getArgumentSignature(index);

        if (argumentSignature) {
            const expectedType = argumentSignature.type;
            if (expectedType) {
                if (typeof value !== expectedType) {
                    throw this.createError('ARGUMENT_TYPE', expectedType, typeof value, index);
                }
            }
            const kind = argumentSignature.kind;
            if (kind) {
                if (proto.isOfKind(value, kind) === false) {
                    throw this.createError('ARGUMENT_KIND', kind, proto.kindOf(value), index);
                }
            }
            const enumValues = argumentSignature.enum;
            if (enumValues) {
                if (enumValues.includes(value) === false) {
                    throw this.createError('ARGUMENT_VALUE', enumValues, value, index);
                }
            }

            const postTransform = argumentSignature.postTransform;
            if (postTransform) {
                value = postTransform.call(this, value);
            }

            const postCheck = argumentSignature.postCheck;
            if (postCheck) {
                if (!postCheck.call(this, value)) {
                    throw this.createError('ARGUMENT_CHECK', value, index);
                }
            }

            if (argumentSignature.name) {
                // this.args[argumentDefinition.name] = arg;
            }
        }

        this.args[index] = value;
    },

    isRestArgumentSignature(signature) {
        return 'name' in signature && signature.name.startsWith('...');
    },

    getLastArgumentSignature() {
        let signature = this.constructorSignature;
        let length = signature.length;

        return length ? signature[length - 1] : null;
    },

    getMaxArgumentLength() {
        let signature = this.constructorSignature;
        let length = signature.length;
        let lastArgumentSignature = this.getLastArgumentSignature();

        if (lastArgumentSignature && this.isRestArgumentSignature(lastArgumentSignature)) {
            if ('max' in lastArgumentSignature) {
                length = lastArgumentSignature.max;
            } else {
                length = Number.MAX_SAFE_INTEGER;
            }
        }

        return length;
    },

    getMinArgumentLength() {
        let signature = this.constructorSignature;
        let requiredDefinitions = signature.filter(function(argumentSignature) {
            return !argumentSignature.optional && 'default' in argumentSignature === false;
        });
        let length = requiredDefinitions.length;
        let lastArgumentSignature = this.getLastArgumentSignature();

        if (lastArgumentSignature && this.isRestArgumentSignature(lastArgumentSignature)) {
            length--;
            if ('min' in lastArgumentSignature) {
                length += lastArgumentSignature.min;
            }
        }

        return length;
    },

    setArguments(args) {
        let signature = this.constructorSignature;

        signature.forEach(function(definition, index) {
            if ('default' in definition && (index in args) === false) {
                args[index] = definition.default;
            }
        });

        let argLength = args.length;

        let minArgumentLength = this.getMinArgumentLength();
        if (argLength < minArgumentLength) {
            throw this.createError('NOT_ENOUGH_ARGUMENT', minArgumentLength, argLength);
        }
        let maxArgumentLength = this.getMaxArgumentLength();
        if (argLength > maxArgumentLength) {
            throw this.createError('TOO_MUCH_ARGUMENT', maxArgumentLength, argLength);
        }

        this.args = args;
        this.args.forEach(this.setArgument, this);

        let lastArgumentSignature = this.getLastArgumentSignature();
        if (lastArgumentSignature && this.isRestArgumentSignature(lastArgumentSignature)) {
            if (lastArgumentSignature.unique) {
                let restSignatureIndex = signature.length - 1;
                let restParams = args.slice(restSignatureIndex);
                let duplicateIndexes = listDuplicateValueKeys(restParams);

                if (duplicateIndexes.length) {
                    throw this.createError(
                        'DUPLICATE_ARGUMENT',
                        restParams[duplicateIndexes[0]],
                        duplicateIndexes.map(function(index) {
                            return index + 1;
                        })
                    );
                }
            }
        }
    },

    sameArguments(instruction) {
        let instructionArgs = instruction.args;
        let selfArgs = this.args;
        let same;

        if (instructionArgs === selfArgs) {
            same = true;
        } else {
            let everyArgumentValueEquals = instruction.args.every(function(arg, index) {
                let selfArgValue = this.args[index];

                if (typeof arg === 'object' && arg.equals) {
                    return arg.equals(selfArgValue);
                }
                return arg === selfArgValue;
            }, this);

            same = everyArgumentValueEquals;
        }

        return same;
    },

    stringify() {
        let name = 'name' in this ? this.name : proto.kindOf(this);

        let string = name + '(' + this.args.map(function(arg) {
            if (typeof arg === 'object' && arg.stringify) {
                return arg.stringify();
            } else if (typeof arg === 'function') {
                return arg.name;
            }

            return String(arg);
        }).join(',') + ')';

        if (this.negated) {
            string = '!(' + string + ')';
        }

        return string;
    },

    /*
    we could parse a string and know the resulting instruction but it's not needed atm
    parse(instructionSource) {
        const firstParenthesisIndex = instructionSource.indexOf('(');
        const name = instructionSource.slice(0, firstParenthesisIndex - 1);
        const argumentSource = instructionSource.slice(firstParenthesisIndex, -1);
    },
    */

    path: [],
    createPathedBranch(path) {
        let branch = this.extend();
        branch.path = path;
        return branch;
    },

    copy(deep = false) {
        let copy = this.extend();

        if (deep) {
            copy.path = this.path.slice();
            copy.args = this.args.map(function(arg) {
                if (typeof arg.copy === 'function') {
                    return arg.copy(deep);
                }
                return arg;
            });
        }

        return copy;
    },

    run() {
        throw new Error('unimplemented instruction run()');
    }
});

// skipReasons
Instruction.define({
    skipReasons: [],

    markAsHavingOwnSkipReasons() {
        if (this.hasOwnProperty('skipReasons') === false) {
            this.skipReasons = this.skipReasons.slice();
        }
    },

    addSkipReason(skipReason) {
        this.markAsHavingOwnSkipReasons();
        this.skipReasons.push(skipReason);
    },

    removeSkipReason(skipReason) {
        let index;

        if (typeof skipReason === 'string') {
            index = this.skipReasons.findIndex(function(addedSkipReason) {
                return addedSkipReason.name === skipReason;
            });
        } else if (typeof skipReason === 'object') {
            index = this.skipReasons.indexOf(skipReason);
        } else {
            throw new TypeError('rmeoveSkipReason first argument must be a string or an object');
        }

        if (index > -1) {
            this.markAsHavingOwnSkipReasons();
            this.skipReasons.splice(index, 1);
            return true;
        }
        return false;
    }
});

const Input = proto.extend('Input', {
    container: null,
    has: false,
    owner: null,
    propertyName: undefined,
    value: undefined,

    constructor(container, path = []) {
        this.path = path;

        let i = 0;
        let j = path.length;
        let inputValue = container;
        let propertyName;
        let owner;
        let hasValue = true;

        for (;i < j; i++) {
            propertyName = path[i];
            if (safeHasProperty(inputValue, propertyName)) {
                owner = inputValue;
                inputValue = inputValue[propertyName];
            } else {
                hasValue = false;
                break;
            }
        }

        // if (('defaultOperator' in this) === false) {
        //     console.log(
        //         'read value for',
        //         this.stringify(),
        //         'at', this.path,
        //         'on', value,
        //         '->', inputValue
        //     );
        // }

        this.has = hasValue;
        this.owner = owner;
        this.propertyName = propertyName;
        this.value = inputValue;
        this.container = container;
    },

    transform(newValue) {
        // this.value = newValue; // DONT DO THIS, the input stay as it is
        // the concept is that you may want to transform the input and consquently update the input object
        // the final version may not change the original input when you want to transform his properties but rather
        // return a fresh object in the right format
        // this way instruction would remains pure, for now I keep modyfing the original object

        let owner = this.owner;
        if (owner !== undefined) {
            let propertyName = this.propertyName;
            owner[propertyName] = newValue;
        }
        // console.log('transform', this.stringify(), 'on', this.input, '->', transformedInputValue);
    }
});

const Output = proto.extend('Output', {
    has: false,
    value: undefined,

    constructor() {

    },

    isTruthy() {
        return Boolean(this.value);
    },

    isFalsy() {
        return Boolean(this.value) === false;
    }
});

// mutation could hold the logic of input transformed into an output so that we have mutation
// mutation.input, mutation.output & mutation.name, mutation.origin allowing to trace mutation circumstances
// instruction is responsible to mutate an input into an output
// remember also there is two things : foramtting a value & validating a value not sure we will allow both at the same time
// so maybe transform will become a mutation in itself
const Mutation = proto.extend('Mutation', {
    instruction: null,
    mutated: false,
    meta: {},
    options: {}, // for now there is no mutation options

    constructor(instruction, input, output) {
        this.instruction = instruction;
        this.input = input;
        this.output = output;
        this.meta = {};
    },

    mutatedHook(mutation) {
        this.output.value = this.value;
        return mutation;
    },

    isPure() {
        return this.mutated === false;
    },

    isMutated() {
        return this.mutated === true;
    },

    mutate() {
        if (this.isMutated()) {
            throw new Error(
                'Mutation.mutate() must not be called once state is mutated'
            );
        }

        this.mutated = true;
        this.mutatedHook(this);
    },

    mutateTo(type, value, origin) {
        this.type = type;
        if (arguments.length > 1) {
            this.value = value;
            if (arguments.length > 2) {
                this.origin = origin;
            }
        }

        return this.mutate();
    },

    skip(...args) {
        return this.mutateTo('skip', ...args);
    },

    throw(...args) {
        return this.mutateTo('error', ...args);
    },

    return(...args) {
        return this.mutateTo('return', ...args);
    },

    transform(transformedInputValue) {
        if (this.isMutated()) {
            throw new Error('instruction.transform() must not be called once instruction state isMutated');
        }

        this.input.transform(transformedInputValue);
    },

    mutators: [
        function() {
            if (this.input.has === false) {
                this.instruction.valueNotFoundHook(this);
            }
        },
        function() {
            this.instruction.beforeHook(this);
        },
        function() {
            let returnValue;
            let hasThrown = false;
            let throwedValue;

            try {
                returnValue = this.instruction.run(this);
            } catch (e) {
                hasThrown = true;
                throwedValue = e;
            }

            if (hasThrown) {
                this.instruction.throwHook(this, throwedValue);
            } else {
                this.instruction.afterHook(this, returnValue);
            }
        },
        function() {
            throw new Error('mutation must mutate');
        }
    ],

    exec() {
        if (this.isPure()) {
            for (let mutator of this.mutators) {
                mutator.call(this);
                if (this.isMutated()) {
                    break;
                }
            }
        }
        return this;
    }
});

// instruction mutation
Instruction.define({
    valueNotFoundHook(mutation) {
        // si l'input n'a pas de propriété on considère que l'instruction ne peut pas s'éxécuter?
        // ou alors on considère que l'instruction est en erreur plutot je pense
        // il manque s^rement une notion d'échec/réussit au lieu de juste isTruthy() isFalsy()
        mutation.return(false);
    },

    beforeHook(mutation) {
        for (let skipReason of this.skipReasons) {
            if (skipReason.method(mutation)) {
                mutation.skip(skipReason);
                break;
            }
        }
    },

    throwHook(mutation, throwedValue) {
        mutation.throw(throwedValue);
        throw throwedValue;
    },

    afterHook(mutation, returnedValue) {
        // console.log('after', this.stringify(), 'output', this.output);
        mutation.return(returnedValue);
    },

    createMutation(value, options = {}) {
        var input = Input.create(value, this.path || []);
        var output = Output.create();
        var mutation = Mutation.create(this, input, output);

        mutation.origin = this; // default mutation origin is the instruction itself
        mutation.options = options;

        return mutation;
    },

    exec(...args) {
        return this.createMutation(...args).exec();
    },

    eval(...args) {
        return this.exec(...args).output.value;
    }
});

export default Instruction;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("", function() {
            var Equals = Instruction.extend({
                constructorSignature: [{}],
                run(mutation) {
                    return this.args[0] === mutation.input.value;
                }
            });

            var equalsFoo = Equals.create('foo');

            assert.equal(equalsFoo.eval('foo'), true);
            assert.equal(equalsFoo.eval('bar'), false);
            assert.equal(equalsFoo.exec('foo').origin, equalsFoo); // mutation origin is the instruction itself

            var nameEqualsFoo = equalsFoo.createPathedBranch(['name']);

            assert.equal(nameEqualsFoo.eval({name: 'foo'}), true);
        });

        // we will have to extensively test the constructorSignature algo
        // but for now we consider it's working

        return assert;
    }
};

/*
// I remember that we need this for instruction on subproperty that must not be runned
// when the property does not exists because we already know the instruction will fail
// we could consider that a missing property means the instruction fails, not that it must be skipped
// we could skip instruction when fails is due to missing property in the case of keyword

Instruction.addSkipReason({
    name: 'has-input',
    method(instruction) {
        if (instruction.input.has === false) {
            this.message = JSON.stringify(instruction.value) + ' must have a value at ' + instruction.path;
            return true;
        }
        return false;
    }
});

// this feature is for keywords
// Instruction.skipWhenValueKindIsNot = undefined;
// Instruction.addSkipReason({
//     name: 'restricted',
//     method(instruction) {
//         let skipWhenValueKindIsNot = instruction.skipWhenValueKindIsNot;
//         if (typeof skipWhenValueKindIsNot === 'undefined') {
//             return false;
//         }
//         if (proto.isOfKind(instruction.input, skipWhenValueKindIsNot)) {
//             return true;
//         }
//         return false;
//     }
// });

Instruction.define({
    copy(deep = false) {
        let copy = this.extend();

        if (deep) {
            copy.path = this.path.slice();
            copy.args = this.args.map(function(arg) {
                if (typeof arg.copy === 'function') {
                    return arg.copy(deep);
                }
                return arg;
            });
        }

        return copy;
    },

    not() {
        // to be really ok we should do extend which wrap stringify around !() and reverse toBoolean
        // and not reverse the negated flag
        const copy = this.copy();

        copy.negated = !this.negated;

        return copy;
    },

    sharePrototype(instruction) {
        let selfPrototype = this.getPurestForm();
        let instructionPrototype = instruction.getPurestForm();

        if (Object.getPrototypeOf(selfPrototype) === Object.getPrototypeOf(instructionPrototype)) {
            return true;
        }
        if (instructionPrototype.isPrototypeOf(selfPrototype)) {
            return true;
        }
        if (selfPrototype.isPrototypeOf(instructionPrototype)) {
            return true;
        }

        return false;
    },

    equals(instruction) {
        if (instruction !== this) {
            if (instruction.sharePrototype(this) === false) {
                return false;
            }
            if (instruction.sameArguments(this) === false) {
                return false;
            }
        }

        return true;
    },

    isOppositeOf(instruction) {
        const selfIsNegated = this.negated;
        const instructionIsNegated = instruction.negated;

        if (selfIsNegated === instructionIsNegated) {
            return false;
        }
        if (this.equals(instruction) === false) {
            return false;
        }

        return true;
    }
});

// chain + compile + exec
Instruction.define({
    combine(operator) {
        if ('operator' in this) {
            throw new Error('instruction has already an operator : ' + this.operator);
        }

        let instruction = this.extend();

        instruction.operator = operator;

        return instruction;
    },

    settle(output) {
        if (this.settled !== false) {
            throw new Error('already settled');
        }
        if (arguments.length > 0) {
            this.output = output;
        }

        // console.log('settle', this.stringify(), 'with', output);

        this.settled = true;
    },

    settleBy(compiledInstruction, output) {
        if (compiledInstruction.settled === false) {
            throw new Error('settleby expect a settled instruction');
        }

        this.settledBy = compiledInstruction;
        if (arguments.length === 1) {
            output = compiledInstruction.output;
        }
        this.settle(output);
    },

    before() {
        // noop
        // console.log('before', this.stringify());
    },

    after(output) {
        // console.log('after', this.stringify(), 'output', this.output);
        this.settle(output);
    },

    eval() {
        // console.log('exec', this.stringify());
        if (this.compiled === false) {
            throw new Error('invalid eval() call : instruction must be compiled');
        }

        let input = this.input;

        if (this.isConcernedBy(input)) {
            if (this.settled === true) {
                throw new Error('invalid eval() call : instruction must not be settled');
            }

            this.before(input);

            let state;
            let output;
            if (this.settled === false) {
                let returnValue;
                let hasThrown = false;
                let throwedValue;

                try {
                    returnValue = this.run(input);
                } catch (e) {
                    hasThrown = true;
                    throwedValue = e;
                }

                if (hasThrown) {
                    state = 'threw';
                    output = throwedValue;
                    throw throwedValue;
                } else {
                    state = 'returned';
                    output = returnValue;
                }

                this.state = state;

                if (this.settled === false) {
                    this.after(output);

                    if (this.settled === false) {
                        throw new Error('instruction must be settled after being evaluated');
                    }
                }
            } else {
                // console.log('prevent eval because settled', this.stringify());
            }
        }

        return this.output;
    },

    exec() {
        const compiledInstruction = this.compile.apply(this, arguments);

        compiledInstruction.eval();

        return compiledInstruction;
    },

    toBoolean() {
        if (this.compiled === false) {
            throw new Error('invalid toBoolean() call : instruction must be compiled');
        }

        let booleanValue = Boolean(this.output);
        if (this.negated) {
            booleanValue = !booleanValue;
        }

        return booleanValue;
    },

    isTruthy() {
        return this.settled ? this.toBoolean() === true : false;
    },

    isFalsy() {
        return this.settled ? this.toBoolean() === false : true;
    }
});

Instruction.define({
    prototypes: [],

    register(name) {
        let args = ['Instruction ' + name, {name: name}];
        args.push.apply(args, Array.prototype.slice.call(arguments, 1));

        let InstructionPrototype = this.extend.apply(this, args);

        this.prototypes.push(InstructionPrototype);

        return InstructionPrototype;
    },

    findPrototypeByName(name) {
        return this.prototypes.find(function(prototype) {
            return prototype.name === name;
        });
    },

    getPrototypeByName(name) {
        if (typeof name !== 'string' || name === '') {
            throw new TypeError('Instruction.getPrototypeByName(name) expect a non empty string');
        }

        let Prototype = this.findPrototypeByName(name);

        if (!Prototype) {
            throw new InstructionError('UNKNOWN', name);
        }

        return Prototype;
    },

    produce(name, ...args) {
        let prototype = this.getPrototypeByName(name);

        return prototype.create.apply(prototype, args);
    }
});
*/

/*
// import I18N from '../../@dmail/node_modules/i18n/index.js';
Instruction.i18n = (function() {
    let i18n = I18N.create();

    const voyels = ['a', 'e', 'i', 'o', 'u'];

    function isVoyel(char) {
        return voyels.includes(char.toLowerCase());
    }

    const nouns = ['null', 'undefined'];
    const consonantExceptions = ['hour', 'herb', 'house', 'heroine'];
    const voyelExceptions = ['universal', 'unique'];

    function aOrAn(noun) {
        const lowerCasedNoun = noun.toLowerCase();
        const lowerCasedFirstChar = lowerCasedNoun[0];

        let isVoyelSound;
        let prefix;

        if (nouns.includes(lowerCasedNoun)) {
            prefix = '';
        } else {
            if (isVoyel(lowerCasedFirstChar)) {
                isVoyelSound = voyelExceptions.includes(lowerCasedNoun) === false;
            } else {
                isVoyelSound = consonantExceptions.includes(lowerCasedNoun);
            }

            prefix = isVoyelSound ? 'an' : 'a';
        }

        return prefix;
    }

    function prefixWithArticle(noun) {
        return aOrAn(noun) + ' ' + noun; // + noun[0].toLowerCase() + noun.slice(1);
    }

    // they should be scoped to en language
    i18n.addFormatters({
        prefixKind: prefixWithArticle,
        prefixType: prefixWithArticle
    });

    i18n.addTraits({
        not(instruction) {
            return instruction.negated === true;
        }
    });

    i18n.addTranslations({
        property: {
            en: "property"
        },
        keyword: {
            en: {
                "": "{name} value must validate {keyword}:{expected}",
                "not": "{name} value must not validate {keyword}:{expected}"
            }
        },
        each: {
            en: {
                "": "each({keywords})",
                "not": "not({keywords})"
            }
        }
    });

    return i18n;
})();
*/

/*
copy(deep){
        const copy = Object.create(Object.getPrototypeOf(this));

        Object.keys(this).forEach(function(key){
            let value = this[key];

            if( deep && typeof value.clone === 'function' && false ===  Instruction.isPrototypeOf(value) ){
                value = value.clone(deep);
            }

            copy[key] = value;
        }, this);

        return copy;
    },

    clone(deep = false){
        const copy = this.copy(deep);

        let current;

        // copy left part of the instructions
        current = copy;
        let previous;
        let previousCopy;
        while(previous = current.previous){
            previousCopy = previous.copy(deep);
            previousCopy.next = current;
            current.previous = previousCopy;
            current = previousCopy;
        }

        // copy right part of the instructions
        current = copy;
        let next;
        let nextCopy;
        while(next = current.next){
            nextCopy = next.copy(deep);
            nextCopy.previous = current;
            current.next = nextCopy;
            current = nextCopy;
        }

        return copy;
    },

var isNotString = isString.not();
var isStringAndNumber = isString.and(isNumber);
var isStringAndNotNumber = isString.and(isNumberInstruction.not());
var isStringOrIsNumberAndString = isString.or(isStringAndNumber);
var complex = isStringOrIsNumberAndString.and(isStringAndNumber);
var isBooleanOrIsStringOrNumber = isBoolean.or(isStringOrNumber);
*/

/*
// an action is an instruction in the context of a macro
const Action = proto.extend('Action', {
    constructor(instruction, mode){
        this.instruction = instruction;
        this.mode = mode;
    },

    exec(value){
        const result = Result.create(this, value);

        return result;
    }
});
*/
