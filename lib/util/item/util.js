var speciesSymbol = typeof Symbol === 'undefined' ? '@@species' : Symbol.species;

function createConstructor(prototype) {
    prototype.constructor.prototype = prototype;
    var constructor = prototype.constructor;
    prototype[speciesSymbol] = constructor;
    return constructor;
}

function extendConstructor(constructor, prototype) {
    var extendedPrototype = Object.create(constructor.prototype);
    if (!prototype) {
        prototype = {};
    }
    Object.assign(extendedPrototype, prototype);

    var extendedConstructor;
    if (prototype.constructor) {
        extendedConstructor = prototype.constructor;
    } else {
        extendedConstructor = function() {
            return constructor.apply(this, arguments);
        };
        extendedPrototype.constructor = extendedConstructor;
    }
    if ((speciesSymbol in prototype) === false) {
        extendedPrototype[speciesSymbol] = extendedConstructor;
    }

    extendedConstructor.prototype = extendedPrototype;
    return extendedConstructor;
}

var isArray = Array.isArray;

var isPrimitive = function(value) {
    if (value === null) {
        return true;
    }
    if (typeof value === 'object' || typeof value === 'function') {
        return false;
    }
    return true;
};

export default {
    speciesSymbol,
    createConstructor,
    extendConstructor,
    isArray,
    isPrimitive
};

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('isPrimitive', function() {
            assert(isPrimitive(true) === true);
            assert(isPrimitive(false) === true);
            assert(isPrimitive(null) === true);
            assert(isPrimitive(undefined) === true);
            assert(isPrimitive(0) === true);
            assert(isPrimitive('') === true);
            assert(isPrimitive({}) === false);
            assert(isPrimitive([]) === false);
            assert(isPrimitive(function() {}) === false);
            assert(isPrimitive(/ok/) === false);
            assert(isPrimitive(new String('')) === false); // eslint-disable-line no-new-wrappers
        });
    }
};

