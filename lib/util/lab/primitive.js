import {
    Element
} from './lab.js';
import {
    CopyTransformation,
    ReplaceReaction
} from './transformation.js';

const PrimitiveProperties = {
    transformation: CopyTransformation,
    reaction: ReplaceReaction,
    referencable: false,

    copy() {
        const copy = this.createConstructor(this.value);
        return copy;
    },

    clone() {
        const clone = this.createConstructor(this.value);
        return clone;
    },

    construct() {
        return this.value;
    }
};

const NullPrimitiveElement = Element.extend('null', PrimitiveProperties, {
    match(value) {
        return value === null;
    }
});
const UndefinedPrimitiveElement = Element.extend('undefined', PrimitiveProperties, {
    match(value) {
        return value === undefined;
    }
});
const BooleanPrimitiveElement = Element.extend('boolean', PrimitiveProperties, {
    match(value) {
        return typeof value === 'boolean';
    }
});
const NumberPrimitiveElement = Element.extend('number', PrimitiveProperties, {
    match(value) {
        return typeof value === 'number';
    }
});
const StringPrimitiveElement = Element.extend('string', PrimitiveProperties, {
    match(value) {
        return typeof value === 'string';
    }
});
const SymbolPrimitiveElement = Element.extend('symbol', PrimitiveProperties, {
    match(value) {
        return value.constructor === Symbol;
    }
});

export {
    PrimitiveProperties,
    NullPrimitiveElement,
    UndefinedPrimitiveElement,
    BooleanPrimitiveElement,
    NumberPrimitiveElement,
    StringPrimitiveElement,
    SymbolPrimitiveElement
};
