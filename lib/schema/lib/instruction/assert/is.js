// still have to allow anyone to dynamically add a sthing to groups no?

import AssertInstruction from '../instruction-assert.js';

const groups = {
    thenable(value) {
        return value !== null && typeof value.then === 'function';
    },

    iterable(value) {
        if (value === null || value === undefined) {
            return false;
        }
        if (typeof value === 'object' || typeof value === 'function') {
            return Symbol.iterator in value;
        }
        // for number, string etc check the object itself then in the prototype
        return value.hasOwnProperty(Symbol.iterator) || Symbol.iterator in Object.getPrototypeOf(value);
    },

    objectlike(value) {
        return value !== null && value !== undefined;
    }
};

const Is = AssertInstruction.register('is', {
    constructorSignature: [
        {type: 'string', enum: Object.keys(groups)}
    ],

    assert() {
        const what = this.args[0];
        const value = arguments[0];

        return groups[what](value);
    }
});

Is.i18n.addTranslation(Is.name, {
    "en": "{name} must be {expected}",
    "en+not": "{name} must not be {expected}"
});

export default Is;

export const test = {
    modules: ['node/assert'],

    suite() {

    }
};
