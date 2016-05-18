/*

double linked list : http://www.thatjsdude.com/interview/linkedList.html

*/

import proto from 'proto';

import I18N from '../../@dmail/node_modules/i18n/index.js';

import InstructionError from './instruction-error.js';

import safeHasProperty from '../util/safe-has-property.js';
import listDuplicateValueKeys from '../util/list-duplicate-value-keys.js';

const Instruction = proto.extend('Instruction', {
    constructorSignature: [],
    negated: false,

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
        if (this.isRestArgumentSignature(lastArgumentSignature)) {
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

    findPrototype(fn, bind) {
        let instruction = this;

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
    },

    getPurestForm() {
        // get first prototype without operator property
        // meaning the instruction purest form: not yet extended by compile() or chain()
        return this.findPrototype(function(inst) {
            return !inst.operator;
        });
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

    run() {
        throw new Error('unimplemented instruction run()');
    }
});

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

// chain + compile + exec
Instruction.define({
    path: [],
    setPath(path) {
        this.path = path;
        // si l'instruction est une instructionlist, il faut set le path de tous les enfant, comme pour eachProperty ?
        if (true || ('defaultOperator' in this) === false) {
            // console.log('set', this.stringify(), 'path to', path);
        }
    },

    combine(operator) {
        if ('operator' in this) {
            throw new Error('instruction has already an operator : ' + this.operator);
        }

        let instruction = this.extend();

        instruction.operator = operator;

        return instruction;
    },

    getInputMeta(value) {
        let path = this.path;
        let i = 0;
        let j = path.length;
        let inputValue = value;
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

        /*
        if (('defaultOperator' in this) === false) {
            console.log(
                'read value for',
                this.stringify(),
                'at', this.path,
                'on', value,
                '->', inputValue
            );
        }
        */

        return {
            has: hasValue,
            owner: owner,
            propertyName: propertyName,
            value: inputValue
        };
    },

    compiled: false,
    value: undefined,
    inputMeta: undefined,

    get input() {
        return this.inputMeta.value;
    },

    set input(inputValue) {
        this.inputMeta.value = inputValue;
    },

    transform(transformedInput) {
        let inputMeta = this.inputMeta;
        let owner = inputMeta.owner;

        if (owner !== undefined) {
            let propertyName = inputMeta.propertyName;
            owner[propertyName] = transformedInput;
        }

        console.log('transform', this.stringify(), 'on', this.input, '->', transformedInput);

        return transformedInput;
    },

    compile(value, options = {}) {
        if (this.compiled) {
            throw new Error('compiled instruction cannot be recompiled');
        }

        let inputMeta = this.getInputMeta(value);
        let compiledInstruction = this.copy();

        compiledInstruction.compiled = true;
        compiledInstruction.value = value;
        compiledInstruction.inputMeta = inputMeta;
        compiledInstruction.compileOptions = options;

        return compiledInstruction;
    },

    state: '',
    settled: false,
    settledBy: null,
    output: undefined,

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

    skipped: false,
    skipReasons: [],
    skipReason: undefined,

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
    },

    getSkippedOutput() {
        return undefined;
    },

    skip(reason) {
        console.log('skip', this.stringify(), reason.name, reason.message);

        this.skipReason = reason;
        this.skipped = true;
        this.settle(this.getSkippedOutput());
    },

    isConcernedBy() {
        let skipped = this.skipped;

        if (skipped === false) {
            for (let skipReason of this.skipReasons) {
                if (skipReason.method(this)) {
                    this.skip(skipReason);
                    skipped = true;
                    break;
                }
            }
        }

        return skipped === false;
    },

    before(/* input */) {
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

Instruction.addSkipReason({
    name: 'has-input',
    method(instruction) {
        if (instruction.inputMeta.has === false) {
            this.message = JSON.stringify(instruction.value) + ' must have a value at ' + instruction.path;
            return true;
        }
        return false;
    }
});
// it should throw error by default
// but for keywords we ignore them because it's how it's specificed for JSON schema and it makes sense to me
// so only for keywords we'll add addSkipReason to restricted instruction
Instruction.restriction = undefined;
Instruction.addSkipReason({
    name: 'restricted',
    method(instruction) {
        let restriction = instruction.restriction;
        return typeof restriction === 'string' && proto.isOfKind(instruction.input, restriction) === false;
    }
});

export default Instruction;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};

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
