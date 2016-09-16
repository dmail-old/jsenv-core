var speciesSymbol;
var tagSymbol;

if (typeof Symbol === 'undefined') {
    speciesSymbol = '@@species';
    tagSymbol = '@@toStringTag';
} else {
    speciesSymbol = Symbol.species;
    if ('toStringTag' in Symbol) {
        tagSymbol = Symbol.toStringTag;
    } else {
        tagSymbol = Symbol();
    }
}

var listKeys = (function() {
    // function getAllEnumerableKeys(object) {
    //     return Object.keys(object);
    // }

    function getAllKeys(object) {
        return Object.getOwnPropertyNames(object);
    }

    function getAllKeysAndSymbols(object) {
        return getAllKeys(object).concat(Object.getOwnPropertySymbols(object));
    }

    var listKeys = Object.getOwnPropertySymbols ? getAllKeysAndSymbols : getAllKeys;

    return listKeys;
})();

var addProperties = (function() {
    function defineProperty(object, name, owner) {
        var descriptor = Object.getOwnPropertyDescriptor(owner, name);
        Object.defineProperty(object, name, descriptor);
    }

    function assignProperty(object, name, owner) {
        object[name] = owner[name];
    }

    var addProperty = Object.defineProperty ? defineProperty : assignProperty;

    function addProperties(object, owner) {
        if (Object(owner) !== owner) {
            throw new TypeError('owner must be an object');
        }

        var keys = listKeys(owner);
        var i = 0;
        var j = keys.length;
        for (;i < j; i++) {
            addProperty(object, keys[i], owner);
        }
    }

    return addProperties;
})();

var sharedProperties = {
    // [tagSymbol]: '',

    define: function() {
        var i = 0;
        var j = arguments.length;

        for (;i < j; i++) {
            addProperties(this, arguments[i]);
        }

        return this;
    },

    extend() {
        var parent;
        var object;

        if (this instanceof Function) {
            parent = this.prototype;
            object = Object.create(parent);
            addProperties(object, sharedProperties);
        } else {
            parent = this;
            object = Object.create(parent);
        }

        var args = arguments;
        var i = 0;
        var j = args.length;

        if (j > 0 && typeof args[0] === 'string') {
            i = 1;
            object[tagSymbol] = args[0];
        }
        for (;i < j; i++) {
            addProperties(object, arguments[i]);
        }

        var constructor;
        var parentConstructor;

        // when we have a custom constructor
        if (Object.prototype.hasOwnProperty.call(object, 'constructor')) {
            constructor = object.constructor;

            if (typeof constructor !== 'function') {
                throw new TypeError('constructor must be a function');
            } else if (constructor === sharedProperties.constructor) {
                // if the constructor is the proto constructor, create an intermediate function
                parentConstructor = sharedProperties.constructor;
                object.constructor = constructor = function() {
                    return parentConstructor.apply(this, arguments);
                };
            }
        } else {
            // create an intermediate function calling parentConstructor
            parentConstructor = this.constructor;
            object.constructor = constructor = function() {
                return parentConstructor.apply(this, arguments);
            };
        }

        object.super = parent;
        constructor.prototype = object;
        constructor.prototype[speciesSymbol] = constructor;
        constructor.super = parent;

        return object;
    },

    create() {
        // https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
        const object = Object.create(this);
        const constructorReturnValue = object.constructor.apply(object, arguments);

        return constructorReturnValue || object;
    }
};

function createConstructor(prototype) {
    var constructor;

    if (prototype && prototype.hasOwnProperty('constructor')) {
        constructor = prototype.constructor;
    } else {
        constructor = function() {

        };
    }

    if (prototype) {
        constructor.prototype = prototype;
        prototype.constructor = constructor;
    }

    constructor.prototype[speciesSymbol] = constructor;
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

    var i = 2;
    var j = arguments.length;
    for (; i < j; i++) {
        Object.assign(extendedPrototype, arguments[i]);
    }

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

var ReferenceMap = createConstructor({
    constructor() {
        this.values = [];
        this.references = [];
    },

    delete(value) {
        let valueIndex = this.values.indexOf(value);
        if (valueIndex > -1) {
            this.values.splice(valueIndex, 1);
            this.references.splice(valueIndex, 1);
        }
    },

    set: function(value, reference) {
        let valueIndex = this.values.indexOf(value);
        let index;
        if (valueIndex === -1) {
            index = this.values.length;
            this.values[index] = value;
        } else {
            index = valueIndex;
        }

        this.references[index] = reference;
    },

    get: function(value) {
        let reference;
        let valueIndex = this.values.indexOf(value);
        if (valueIndex > -1) {
            reference = this.references[valueIndex];
        } else {
            reference = null;
        }
        return reference;
    }
});

export default {
    speciesSymbol,
    createConstructor,
    extendConstructor,
    isArray,
    isPrimitive,
    ReferenceMap,
    extend: sharedProperties.extend.bind(sharedProperties)
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

        this.add('createConstructor', function() {
            let WithoutPrototype = createConstructor();
            let WithoutConstructor = createConstructor({foo: true});
            let Basic = createConstructor({
                constructor() {

                }
            });

            assert(WithoutPrototype.prototype.hasOwnProperty('constructor'));
            assert(WithoutConstructor.prototype.foo === true);
            assert(Basic.prototype.constructor === Basic);
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

