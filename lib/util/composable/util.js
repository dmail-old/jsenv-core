var speciesSymbol;
var tagSymbol;
var superSymbol;

if (typeof Symbol === 'undefined') {
    speciesSymbol = '@@species';
    tagSymbol = '@@toStringTag';
    superSymbol = '@@super';
} else {
    if ('species' in Symbol) {
        speciesSymbol = Symbol.species;
    } else {
        speciesSymbol = Symbol();
    }
    if ('toStringTag' in Symbol) {
        tagSymbol = Symbol.toStringTag;
    } else {
        tagSymbol = Symbol();
    }
    superSymbol = Symbol();
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

function linkConstructorAndPrototype(constructor, prototype) {
    constructor.prototype = prototype;
    prototype[speciesSymbol] = constructor;
    // constructor[superObject] = superObject;
}

var construct = (function() {
    var construct;

    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.reflect.construct.js
    if (Reflect && 'construct' in Reflect) {
        construct = Reflect.construct;
    } else {
        // https://gist.github.com/dmail/6e639ac50cec8074a346c9e10e76fa65
        var ProxiedConstructor;
        var ConstructorProxy = function(args) {
            return ProxiedConstructor.apply(this, args);
        };

        return function(Constructor, args/* , instanceConstructor */) {
            var instance;

            switch (args.length) {
                case 0:
                    instance = new Constructor();
                    break;
                case 1:
                    instance = new Constructor(args[0]);
                    break;
                case 2:
                    instance = new Constructor(args[0], args[1]);
                    break;
                default:
                    ProxiedConstructor = Constructor;
                    ConstructorProxy.prototype = Constructor.prototype;
                    instance = new ConstructorProxy(args);
                    ConstructorProxy.prototype = null;
                    break;
            }

            if (arguments.length > 2) {
                instance.constructor = arguments[2];
            }

            return instance;
        };
    }

    return construct;
})();

var proto = {
    // [tagSymbol]: '',
    constructor() {

    },

    definePropertyOf(owner, name) {
        var descriptor = Object.getOwnPropertyDescriptor(owner, name);

        if (name === 'constructor') {
            let constructor = descriptor.value;

            if (typeof constructor !== 'function') {
                throw new TypeError('object.constructor must be a function');
            }
            if (constructor === this[superSymbol].constructor) {
                throw new Error('object.constructor must not be the same as superObject.constructor');
            }
            linkConstructorAndPrototype(constructor, this);
        }

        Object.defineProperty(this, name, descriptor);
    },

    refine() {
        var i = 0;
        var j = arguments.length;
        var owner;

        for (;i < j; i++) {
            owner = arguments[i];
            if (Object(owner) !== owner) {
                throw new TypeError('owner must be an object');
            }

            var keys = listKeys(owner);
            var keyIndex = 0;
            var keyLength = keys.length;
            for (;keyIndex < keyLength; keyIndex++) {
                this.definePropertyOf(owner, keys[keyIndex]);
            }
        }

        return this;
    },

    reconstruct(constructor) {
        const currentConstructor = this.constructor;
        const combinedConstructor = function() {
            let instance = this;
            const currentConstructorReturnValue = currentConstructor.apply(this, arguments);
            if (currentConstructorReturnValue && typeof currentConstructorReturnValue === 'object') {
                instance = currentConstructorReturnValue;
            }
            const constructorReturnValue = constructor.apply(instance, arguments);
            if (constructorReturnValue && typeof constructorReturnValue === 'object') {
                instance = constructorReturnValue;
            }
            return instance;
        };
        return proto.refine.call(this, {constructor: combinedConstructor});
    },

    use(Component, ...args) {
        const constructor = Component.constructor;
        delete Component.constructor; // prevent constructor redefinition

        proto.refine.call(this, Component); // define Component properties
        const component = Component.compile(...args);
        proto.refine.call(this, component); // define compiled component properties

        Component.constructor = constructor; // restor constructor

        return this.reconstruct(constructor);
    },

    extend() {
        var superObject;
        var object;

        if (this instanceof Function) {
            superObject = this.prototype;
            object = Object.create(superObject);
            object[superSymbol] = superObject;
            proto.refine.call(object, proto);
        } else {
            superObject = this;
            object = Object.create(superObject);
            object[superSymbol] = superObject;
        }

        var args = arguments;
        var i = 0;
        var j = args.length;
        if (j > 0 && typeof args[0] === 'string') {
            i = 1;
            object[tagSymbol] = args[0];
        }
        for (;i < j; i++) {
            proto.refine.call(object, arguments[i]);
        }

        // force object to have a constructor
        if (Object.prototype.hasOwnProperty.call(object, 'constructor') === false) {
            const superConstructor = superObject.constructor;
            const superConstructorProxy = function() {
                return superConstructor.apply(this, arguments);
            };
            linkConstructorAndPrototype(superConstructorProxy, object);
            object.constructor = superConstructorProxy;
        }

        return object;
    },

    create() {
        return construct(this.constructor, arguments);
    },

    createConstructor() {
        return construct(this[speciesSymbol] || this.constructor, arguments);
    }
};

// function createConstructor(prototype) {
//     var constructor;

//     if (prototype && prototype.hasOwnProperty('constructor')) {
//         constructor = prototype.constructor;
//     } else {
//         constructor = function() {

//         };
//     }

//     if (prototype) {
//         constructor.prototype = prototype;
//         prototype.constructor = constructor;
//     }

//     constructor.prototype[speciesSymbol] = constructor;
//     return constructor;
// }

// function extendConstructor(constructor, prototype) {
//     var extendedPrototype = Object.create(constructor.prototype);
//     var extendedConstructor;

//     if (prototype) {
//         Object.assign(extendedPrototype, prototype);
//         extendedConstructor = prototype.constructor;
//     }

//     if (!prototype || prototype.hasOwnProperty('constructor') === false) {
//         extendedConstructor = function() {
//             return constructor.apply(this, arguments);
//         };
//         extendedPrototype.constructor = extendedConstructor;
//     }
//     if (!prototype || prototype.hasOwnProperty(speciesSymbol) === false) {
//         extendedPrototype[speciesSymbol] = extendedConstructor;
//     }

//     extendedConstructor.prototype = extendedPrototype;

//     var i = 2;
//     var j = arguments.length;
//     for (; i < j; i++) {
//         Object.assign(extendedPrototype, arguments[i]);
//     }

//     return extendedConstructor;
// }

// var isArray = Array.isArray;

// var isPrimitive = function(value) {
//     if (value === null) {
//         return true;
//     }
//     if (typeof value === 'object' || typeof value === 'function') {
//         return false;
//     }
//     return true;
// };

// var ReferenceMap = createConstructor({
//     constructor() {
//         this.values = [];
//         this.references = [];
//     },

//     delete(value) {
//         let valueIndex = this.values.indexOf(value);
//         if (valueIndex > -1) {
//             this.values.splice(valueIndex, 1);
//             this.references.splice(valueIndex, 1);
//         }
//     },

//     set: function(value, reference) {
//         let valueIndex = this.values.indexOf(value);
//         let index;
//         if (valueIndex === -1) {
//             index = this.values.length;
//             this.values[index] = value;
//         } else {
//             index = valueIndex;
//         }

//         this.references[index] = reference;
//     },

//     get: function(value) {
//         let reference;
//         let valueIndex = this.values.indexOf(value);
//         if (valueIndex > -1) {
//             reference = this.references[valueIndex];
//         } else {
//             reference = null;
//         }
//         return reference;
//     }
// });

export default proto;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function assertPrototypeRelationShip(Prototype, SuperPrototype) {
            assert(Prototype.constructor.prototype === Prototype);
            assert(Prototype[speciesSymbol] === Prototype.constructor);
            assert(Prototype[superSymbol] === SuperPrototype);
        }

        this.add('extend', function() {
            const Main = proto.extend();
            assertPrototypeRelationShip(Main, proto);

            const ExtendedMain = Main.extend();
            assertPrototypeRelationShip(ExtendedMain, Main);

            let constructor = function() {};
            let ExtendedMainWithConstructor = Main.extend({
                constructor: constructor
            });
            assertPrototypeRelationShip(ExtendedMainWithConstructor, Main);

            // assert that we can define constructor later it still works
            constructor = function() {};
            ExtendedMainWithConstructor.refine({
                constructor: constructor
            });
            assertPrototypeRelationShip(ExtendedMainWithConstructor, Main);
            assert(ExtendedMainWithConstructor.constructor === constructor);
        });

        // this.add('isPrimitive', function() {
        //     assert(isPrimitive(true) === true);
        //     assert(isPrimitive(false) === true);
        //     assert(isPrimitive(null) === true);
        //     assert(isPrimitive(undefined) === true);
        //     assert(isPrimitive(0) === true);
        //     assert(isPrimitive('') === true);
        //     assert(isPrimitive({}) === false);
        //     assert(isPrimitive([]) === false);
        //     assert(isPrimitive(function() {}) === false);
        //     assert(isPrimitive(/ok/) === false);
        //     assert(isPrimitive(new String('')) === false); // eslint-disable-line no-new-wrappers
        // });

        // this.add('createConstructor', function() {
        //     let WithoutPrototype = createConstructor();
        //     let WithoutConstructor = createConstructor({foo: true});
        //     let Basic = createConstructor({
        //         constructor() {

        //         }
        //     });

        //     assert(WithoutPrototype.prototype.hasOwnProperty('constructor'));
        //     assert(WithoutConstructor.prototype.foo === true);
        //     assert(Basic.prototype.constructor === Basic);
        // });

        // this.add('extendConstructor', function() {
        //     let Main = createConstructor({
        //         constructor() {

        //         }
        //     });
        //     let ExtendedMain = extendConstructor(Main, {
        //         constructor() {
        //             Main.apply(this, arguments);
        //         }
        //     });
        //     // this one is to check we can omit constructor
        //     let SecondExtendedMain = extendConstructor(Main, {

        //     });
        //     let NestedMain = extendConstructor(ExtendedMain, {
        //         constructor() {

        //         }
        //     });

        //     assert(ExtendedMain.prototype instanceof Main);
        //     assert(SecondExtendedMain.prototype instanceof Main);
        //     assert(NestedMain.prototype instanceof ExtendedMain);
        // });
    }
};

