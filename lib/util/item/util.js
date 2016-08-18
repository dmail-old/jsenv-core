function createConstructor(prototype) {
    prototype.constructor.prototype = prototype;
    return prototype.constructor;
}

function extendConstructor(constructor, prototype) {
    var extendedPrototype = Object.create(constructor.prototype);
    if (!prototype) {
        prototype = {};
    }
    if (!prototype.constructor) {
        prototype.constructor = function() {
            return constructor.apply(this, arguments);
        };
    }

    Object.assign(extendedPrototype, prototype);
    extendedPrototype.constructor.prototype = extendedPrototype;

    return extendedPrototype.constructor;
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

