var speciesSymbol = typeof Symbol === 'undefined' ? '@@species' : Symbol.species;

function createConstructor(prototype) {
    prototype.constructor.prototype = prototype;
    var constructor = prototype.constructor;
    prototype[speciesSymbol] = constructor;
    return constructor;
}

function extendConstructor(constructor, prototype) {
    var extendedPrototype = Object.create(constructor.prototype);
    var extendedConstructor;

    if (prototype) {
        Object.assign(extendedPrototype, prototype);
        extendedConstructor = prototype.constructor;
    }

    if (!prototype || prototype.hasOwnProperty('constructor') === false) {
        extendedConstructor = function() {
            return constructor.apply(this, arguments);
        };
        extendedPrototype.constructor = extendedConstructor;
    }
    if (!prototype || prototype.hasOwnProperty(speciesSymbol) === false) {
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

        this.add('extendConstructor', function() {
            let Main = createConstructor({
                constructor() {

                }
            });
            let ExtendedMain = extendConstructor(Main, {
                constructor() {
                    Main.apply(this, arguments);
                }
            });
            // this one is to check we can omit constructor
            let SecondExtendedMain = extendConstructor(Main, {

            });
            let NestedMain = extendConstructor(ExtendedMain, {
                constructor() {

                }
            });

            assert(ExtendedMain.prototype instanceof Main);
            assert(SecondExtendedMain.prototype instanceof Main);
            assert(NestedMain.prototype instanceof ExtendedMain);
        });
    }
};

