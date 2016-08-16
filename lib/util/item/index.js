/*

Notes:

This JavaScript file must make the fewer possible assumptions about the available js features
So that it may be runned in the largest amount of JavaScript environment
It uses an es6 syntax but one possible usage could be to compile to es5 and put it in IE8 without any polyfill required

name: Object.cloning
https://gist.github.com/NV/1396086

On pourrait l'apeller any
any.scan(true); // get definition of true
any.createFactory(true); // get a factor of true value

todo :
- enable reference logic (prevent circular structure & perf boost when value is the same, disabled for primitive)
- allow array concatenation
- allow an option called functionCloningStrategy : 'primitive', 'bind', 'wrap', 'eval' defaulting to primitive
it means valueGenerator will not copy the function and use the original one making it useless to list function properties
but functionCloningStrategy will be an option of valueGenerator not of ValueDefinition
one possible solution could be that something above valueGenerator knows valueGenerator will consider function as primitive
and thus will pass a valueDefinition to valueGenerator faking that function are primitive
when defined to 'bind' function are bound to their parent valueDefinition
the main cost becomes perf, stacktrace (not sure about stacktrace issue) and function.toString would print [native code]
- when properties of function are defined, we should not try to make the 'prototype' property immutable we can safely set it
on the created function, name is now configurable so it can be copied

- add an option called objectCloningStrategy: 'create', 'extend', defaulting to create
extend would do Object.create(valueDefinition.value) while create does Object.create(Object.getPrototypeOf(valueDefinition.value));
that extend would be used to inherit from model instead of beign completely deteched from it
- allow a custom getPropertyNames() when constructing a valueDefinition so that we only get a subset of the property definitions
- proto must use valueGenerator and we must obtain the desired result : immutable object on extend() & create()
*/

// ------ REFERENCES -----
// findPropertyDefinition(fn, bind) {
//     var matched;
//     var propertyDefinitions = this.propertyDefinitions;
//     var i = propertyDefinitions.length;

//     while (i--) {
//         var propertyDefinition = propertyDefinitions[i];
//         if (fn.call(bind, propertyDefinition)) {
//             matched = propertyDefinition;
//             break;
//         }
//     }
//     if (!matched) {
//         // search in parent
//         var parent = this.parent;
//         if (parent) {
//             matched = parent.findPropertyDefinition(fn, bind);
//         }
//     }

//     return matched;
// }
// equals(definition) {
//     var selfDescriptor = this.descriptor;
//     var definitionDescriptor = definition.descriptor;
//     var areEquals;

//     var descriptorAreEquivalent;
//     if (definitionDescriptor === null) {
//         descriptorAreEquivalent = selfDescriptor === null;
//     } else {
//         descriptorAreEquivalent = selfDescriptor !== null;
//     }

//     if (descriptorAreEquivalent) {
//         if (
//             definitionDescriptor.configurable === selfDescriptor.configurable &&
//             definitionDescriptor.enumerable === selfDescriptor.enumerable &&
//             definitionDescriptor.writable === selfDescriptor.writable
//         ) {
//             if ('value' in definitionDescriptor) {
//                 areEquals = 'value' in selfDescriptor && definitionDescriptor.value === selfDescriptor.value;
//             } else {
//                 var setAreEquivalent;
//                 if ('set' in definitionDescriptor) {
//                     setAreEquivalent = 'set' in selfDescriptor &&
//                     definitionDescriptor.set === selfDescriptor.set;
//                 }
//                 var getAreEquivalent;
//                 if ('get' in definitionDescriptor) {
//                     getAreEquivalent = 'get' in selfDescriptor &&
//                     definitionDescriptor.get === selfDescriptor.get;
//                 }

//                 areEquals = setAreEquivalent && getAreEquivalent;
//             }
//         } else {
//             areEquals = false;
//         }
//     } else {
//         areEquals = false;
//     }

//     return areEquals;
// }

// ----- ARRAY CONCATENATION -------
// var stringIsInteger = function(string) {
//     if (isNaN(string)) {
//         return false;
//     }
//     var number = parseInt(string);
//     return Number.isInteger(number);
// };
// var mustConcatArray =
//     firstDefinition.parent &&
//     isArray(firstDefinition.parent.descriptor.value) &&
//     secondDefinition.parent &&
//     isArray(secondDefinition.parent.descriptor.value)
// ;
// if (mustConcatArray) {
//     var propertyName = firstDefinition.propertyName;
//     var firstLength;
//     var secondLength;

//     if (propertyName === 'length') {
//         firstLength = firstDefinition.descriptor.value;
//         secondLength = secondDefinition.descriptor.value;

//         mutatedProperties.value = firstLength + secondLength;
//     } else if (stringIsInteger(propertyName)) {
//         firstLength = firstDefinition.descriptor.value;
//         var freePropertyName = String(firstLength + Number(propertyName));

//         // ignore the conflict for interger properties and
//         // instead set a new definitions for the next free interger property
//         // for now consider there is no need to clone the descriptor.value because
//         // we prevent array deepCloning by default (it would be done just by canSpread below)

//         mutatedProperties.name = freePropertyName;
//     }
// }

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

var ValueDefinition = (function() {
    var listKeys = (function() {
        function getAllEnumerableKeys(object) {
            return Object.getOwnPropertyNames(object);
        }

        function getAllKeysAndSymbols(object) {
            return Object.getOwnPropertyNames(object).concat(Object.getOwnPropertySymbols(object));
        }

        var getAllKeys = Object.getOwnPropertySymbols ? getAllKeysAndSymbols : getAllEnumerableKeys;

        return getAllKeys;
    })();

    var getPropertyNames = function(value, option = 'auto') {
        var propertyNames;

        if (isPrimitive(value)) {
            propertyNames = [];
        } else if (option === 'auto') {
            propertyNames = listKeys(value);
        } else if (isArray(option)) {
            propertyNames = option.filter(function(propertyName) {
                return Object.prototype.hasOwnProperty.call(value, propertyName);
            });
        }

        return propertyNames;
    };

    var PropertyDefinition = createConstructor({
        constructor(name, descriptor, valueDefinition) {
            this.name = name;
            this.descriptor = descriptor;
            this.valueDefinition = valueDefinition;
        }
    });

    var speciesSymbol = typeof Symbol === 'undefined' ? '@@species' : Symbol.species;

    function concatDescriptor(firstDescriptor, secondDescriptor) {
        var concatenedDescriptor;
        if (secondDescriptor) {
            if ('value' in secondDescriptor) {
                concatenedDescriptor = secondDescriptor;
            } else {
                concatenedDescriptor = {};
                concatenedDescriptor.enumerable = secondDescriptor.enumerable;
                concatenedDescriptor.configurable = secondDescriptor.configurable;
                concatenedDescriptor.set = secondDescriptor.set || firstDescriptor.set;
                concatenedDescriptor.get = secondDescriptor.get || firstDescriptor.get;
            }
        } else {
            concatenedDescriptor = secondDescriptor;
        }
        return concatenedDescriptor;
    }

    var ValueDefinition = createConstructor({
        value: undefined,
        referenceMark: false,
        reference: null,
        references: [],
        primitiveMark: false,
        prototype: null,
        frozenMark: false, // true means cannot add & remove new property, existing property becomes unconfigurable & unwritable
        sealedMark: false, // true means cannot add & remove new property, existing property becomes unconfigurable
        extensibleMark: true, // false means cannot add new property
        propertyDefinitions: [],
        parent: null,
        get property() {
            if (this.parent) {
                return this.parent.propertyDefinitions.find(function(propertyDefinition) {
                    return propertyDefinition.valueDefinition === this;
                }, this);
            }
            return null;
        },
        get propertyName() {
            var property = this.property;
            return property ? property.name : undefined;
        },

        constructor() {},

        markAsReferenceTo(reference) {
            this.referenceMark = true;
            this.reference = reference;
            if (!reference.hasOwnProperty('references')) {
                reference.references = [];
            }
            reference.references.push(this);
        },

        populate(value) {
            this.value = value;
            // scan if value is a reference to something we know
            this.populateReference();
            if (this.referenceMark === false) {
                // scan if the value is primitive (a lot of stuff depends on this)
                this.populatePrimitivity();
                if (this.primitiveMark === false) {
                    // when value is not a primitive scan its prototype, attributes & properties
                    this.populatePrototype();
                    this.populateAttributes();
                    this.populateProperties();
                }
            }
            return this;
        },

        // * yieldPropertiesDefinitions() {
        yieldPropertiesDefinitions(excludedPropertyValueDefinition) {
            let list = [];
            let valueDefinition = this;

            for (let propertyDefinition of valueDefinition.propertyDefinitions) {
                let propertyValueDefinition = propertyDefinition.valueDefinition;
                if (
                    propertyValueDefinition &&
                    propertyValueDefinition.referenceMark !== true &&
                    propertyValueDefinition !== excludedPropertyValueDefinition
                ) {
                    // yield propertyValueDefinition;
                    // yield * propertyValueDefinition.yieldPropertiesDefinitions();
                    list.push(propertyValueDefinition);
                    list.push(...propertyValueDefinition.yieldPropertiesDefinitions());
                }
            }

            return list;
        },

        // * yieldValueDefinitions() {
        yieldValueDefinitions() {
            let valueDefinition = this;
            let list = [];

            // yield * valueDefinition.yieldPropertiesDefinitions();
            list.push(...valueDefinition.yieldPropertiesDefinitions());
            let excludedValueDefinition = valueDefinition;
            let ancestorValueDefinition = valueDefinition.parent;
            while (ancestorValueDefinition) {
                // yield ancestorValueDefinition;
                // yield * ancestorValueDefinition.yieldPropertiesDefinitions(excludedValueDefinition);
                list.push(ancestorValueDefinition);
                list.push(...ancestorValueDefinition.yieldPropertiesDefinitions(excludedValueDefinition));
                excludedValueDefinition = ancestorValueDefinition;
                ancestorValueDefinition = ancestorValueDefinition.parent;
            }

            return list;
        },

        findReference(value) {
            let reference;

            for (let valueDefinition of this.yieldValueDefinitions()) {
                if (valueDefinition.value === value) {
                    reference = valueDefinition;
                    break;
                }
            }

            return reference;
        },

        populateReference() {
            var existingDefinition = this.findReference(this.value);

            if (existingDefinition) {
                // console.log('reference to value', this.value, 'at property', this.propertyName);
                this.markAsReferenceTo(existingDefinition);
            }
        },

        populatePrimitivity() {
            let value = this.value;

            // harcoding typeof value === 'function' to primitive but that's ugly
            // you may want to know if a function object isSealed and list its properties
            // they must be considered primitive only when the definition is used for a generator
            // and that the generator handle function as primitive
            if (isPrimitive(value) || typeof value === 'function') {
                this.primitiveMark = true;
            }
        },

        populatePrototype() {
            let value = this.value;

            if (speciesSymbol in value) {
                this.prototype = value[speciesSymbol].prototype;
            } else {
                this.prototype = Object.getPrototypeOf(value);
            }
        },

        populateAttributes() {
            let value = this.value;

            if (Object.isFrozen(value)) {
                this.frozenMark = true;
            } else if (Object.isSealed(value)) {
                this.sealedMark = true;
            } else if (Object.isExtensible(value) === false) {
                this.extensibleMark = false;
            }
        },

        populateProperties() {
            let value = this.value;
            let propertyNames = getPropertyNames(value);

            this.propertyDefinitions = [];

            propertyNames.forEach(function(propertyName) {
                var propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
                var propertyDefinition = new PropertyDefinition(propertyName, propertyDescriptor);
                this.propertyDefinitions.push(propertyDefinition);

                var propertyValueDefinition;
                if (propertyDescriptor === null) {
                    // the property does not exists
                } else if ('value' in propertyDescriptor) {
                    var propertyValue = propertyDescriptor.value;
                    propertyValueDefinition = new this.constructor();
                    propertyValueDefinition.parent = this;
                    propertyValueDefinition.populate(propertyValue);
                    propertyDefinition.valueDefinition = propertyValueDefinition;
                } else {
                    // property has no valueDefinition, it does have a getter and or setter
                }
            }, this);
        },

        getPropertyDefinition(propertyName) {
            return this.propertyDefinitions.find(function(propertyDefinition) {
                return propertyDefinition.name === propertyName;
            });
        },

        getPropertyValueDefinition(propertyName) {
            let propertyDefinition = this.getPropertyDefinition(propertyName);
            return propertyDefinition ? propertyDefinition.valueDefinition : null;
        },

        clonePropertyDefinition(propertyDefinition) {
            var cloneName = propertyDefinition.name;
            var cloneDescriptor = propertyDefinition.descriptor;
            var propertyValueDefinition = propertyDefinition.valueDefinition;
            var cloneValueDefinition;
            if (propertyValueDefinition) {
                cloneValueDefinition = propertyValueDefinition.branch();
                cloneValueDefinition.parent = this;
                cloneValueDefinition.populateWith(propertyValueDefinition);
            }
            var clonedPropertyDefinition = new propertyDefinition.constructor(
                cloneName,
                cloneDescriptor,
                cloneValueDefinition
            );

            return clonedPropertyDefinition;
        },

        groupPropertyDefinitions() {
            var groups = [];
            var args = arguments;
            var i = 0;
            var j = args.length;
            for (; i < j; i++) {
                var propertyDefinitions = args[i];
                var propertyDefinitionIndex = 0;
                var propertyDefinitionsLength = propertyDefinitions.length;

                for (; propertyDefinitionIndex < propertyDefinitionsLength; propertyDefinitionIndex++) {
                    var propertyDefinition = propertyDefinitions[propertyDefinitionIndex];

                    var propertyName = propertyDefinition.name;
                    var existingPropertyDefinitionGroup;
                    if (i > 0) { // no group exist on first loop
                        existingPropertyDefinitionGroup = groups.find(function(group) { // eslint-disable-line
                            return group[0].name === propertyName;
                        });
                    }

                    var group;
                    if (existingPropertyDefinitionGroup) {
                        group = existingPropertyDefinitionGroup;
                        group.push(propertyDefinition);
                    } else {
                        group = [];
                        group.push(propertyDefinition);
                        groups.push(group);
                    }
                }
            }

            return groups;
        },

        concatValueDefinition(firstValueDefinition, secondValueDefinition) {
            var concatenedValueDefinition;

            if (secondValueDefinition) {
                if (firstValueDefinition) {
                    concatenedValueDefinition = firstValueDefinition.branch();
                    concatenedValueDefinition.parent = this;
                    concatenedValueDefinition.fillWith(firstValueDefinition, secondValueDefinition);
                } else {
                    concatenedValueDefinition = secondValueDefinition.branch();
                    concatenedValueDefinition.parent = this;
                    concatenedValueDefinition.populateWith(secondValueDefinition);
                }
            } else {
                concatenedValueDefinition = undefined;
            }

            return concatenedValueDefinition;
        },

        concatPropertyDefinition(firstPropertyDefinition, secondPropertyDefinition) {
            var ConcatenedConstructor = firstPropertyDefinition.constructor;
            var concatenedName = secondPropertyDefinition.name;
            var concatenedDescriptor = concatDescriptor(
                firstPropertyDefinition.descriptor,
                secondPropertyDefinition.descriptor
            );
            var concatenedValueDefinition = this.concatValueDefinition(
                firstPropertyDefinition.valueDefinition,
                secondPropertyDefinition.valueDefinition
            );
            var concatenedPropertyDefinition = new ConcatenedConstructor(
                concatenedName,
                concatenedDescriptor,
                concatenedValueDefinition
            );

            return concatenedPropertyDefinition;
        },

        branch() {
            return new this.constructor();
        },

        adopt(valueDefinition) {
            this.value = valueDefinition.value;

            if (valueDefinition.primitiveMark) {
                this.primitiveMark = true;
            } else {
                this.prototype = valueDefinition.prototype;
                // we should write valueDefinition.frozenMark !== this.constructor.frozenMark but hey let's assume it does not change
                if (valueDefinition.frozenMark) {
                    this.frozenMark = true;
                } else if (valueDefinition.sealedMark) {
                    this.sealedMark = true;
                } else if (valueDefinition.extensibleMark === false) {
                    this.extensibleMark = false;
                }
                // this.propertyDefinitions = valueDefinition.propertyDefinitions;
            }
        },

        fillWith(firstValueDefinition, secondValueDefinition) {
            if (firstValueDefinition.referenceMark) {
                firstValueDefinition = firstValueDefinition.reference;
            }
            if (secondValueDefinition.referenceMark) {
                secondValueDefinition = secondValueDefinition.reference;
            }

            if (firstValueDefinition.primitiveMark || secondValueDefinition.primitiveMark) {
                this.adopt(secondValueDefinition);
            } else {
                var reference = this.findReference(firstValueDefinition.value);
                if (reference) {
                    this.markAsReferenceTo(reference);
                } else {
                    this.adopt(firstValueDefinition);
                    this.propertyDefinitions = [];

                    var firstPropertyDefinitions = firstValueDefinition.propertyDefinitions;
                    var secondPropertyDefinitions = secondValueDefinition.propertyDefinitions;
                    var groups = this.groupPropertyDefinitions(
                        firstPropertyDefinitions,
                        secondPropertyDefinitions
                    );
                    var i = 0;
                    var j = groups.length;
                    // console.log('group repartition', groups.map(function(group) {
                    //     return group[0].name + ':' + group.length;
                    // }));

                    for (;i < j; i++) {
                        var group = groups[i];
                        var groupLength = group.length;
                        var concatenedPropertyDefinition;

                        if (groupLength === 1) {
                            var propertyDefinition = group[0];
                            // console.log('cloning propertyDefinition', propertyDefinition.name);
                            concatenedPropertyDefinition = this.clonePropertyDefinition(
                                propertyDefinition
                            );
                        } else {
                            concatenedPropertyDefinition = this.concatPropertyDefinition(
                                group[0], group[1]
                            );
                        }

                        this.propertyDefinitions.push(concatenedPropertyDefinition);
                    }
                }
            }
        },

        populateWith(valueDefinition) {
            var reference = this.findReference(valueDefinition.value);
            if (reference) {
                this.markAsReferenceTo(reference);
            } else {
                this.adopt(valueDefinition);
                this.propertyDefinitions = valueDefinition.propertyDefinitions.map(
                    this.clonePropertyDefinition,
                    this
                );
            }
        },

        concat(valueDefinition) {
            var concatenedDefinition = this.branch();
            concatenedDefinition.fillWith(this, valueDefinition);
            return concatenedDefinition;
        },

        clone() {
            var clonedDefinition = this.branch();
            clonedDefinition.populateWith(this);
            return clonedDefinition;
        }
    });

    return ValueDefinition;
})();

var ValueGenerator = createConstructor({
    constructor() {

    },

    match() {
        return false;
    },

    generate() {
        return undefined;
    }
});

var ValueDefinitionGenerator = createConstructor({
    generators: [],

    constructor(valueDefinition) {
        if (arguments.length === 0) {
            throw new Error('ValueGenerator constructor expect one arguments');
        }
        if (valueDefinition instanceof ValueDefinition === false) {
            throw new Error('ValueGenerator constructor first argument must be a valueDefinition instance');
        }
        this.valueDefinition = valueDefinition;
        this.generator = this.findGenerator(valueDefinition);

        if (!this.generator) {
            throw new Error('no registered generator matched the valueDefinition ' + valueDefinition);
        }
    },

    findGenerator(valueDefinition) {
        var generators = this.generators;
        var i = 0;
        var j = generators.length;
        var generatorFound;

        for (;i < j; i++) {
            var generator = generators[i];
            if (generator.match(valueDefinition)) {
                generatorFound = generator;
                break;
            }
        }

        return generatorFound;
    },

    createValue() {
        return this.generator.create(this.valueDefinition);
    },

    defineProperties(value) {
        var valueDefinition = this.valueDefinition;
        var propertyDefinitions = valueDefinition.propertyDefinitions;
        var i = 0;
        var j = propertyDefinitions.length;

        for (; i < j; i++) {
            var propertyDefinition = propertyDefinitions[i];
            var propertyDefinitionDescriptor = propertyDefinition.descriptor;
            var propertyDescriptor;
            var propertyName = propertyDefinition.name;

            if (propertyDefinitionDescriptor) {
                var propertyDefinitionValueDefinition = propertyDefinition.valueDefinition;
                if (propertyDefinitionValueDefinition) {
                    var propertyValueGenerator = new this.constructor(propertyDefinitionValueDefinition);
                    var propertyValue = propertyDefinitionValueDefinition.value;
                    var generatedPropertyValue = propertyValueGenerator.generate();

                    if (generatedPropertyValue === propertyValue) {
                        propertyDescriptor = propertyDefinitionDescriptor;
                    } else {
                        propertyDescriptor = Object.assign(
                            {},
                            propertyDefinitionDescriptor,
                            {value: generatedPropertyValue}
                        );
                    }
                } else {
                    propertyDescriptor = propertyDefinitionDescriptor;
                }

                Object.defineProperty(value, propertyName, propertyDescriptor);
            }
        }
    },

    defineAttributes(value) {
        var valueDefinition = this.valueDefinition;

        if (valueDefinition.frozenMark) {
            Object.freeze(value);
        } else if (valueDefinition.sealedMark) {
            Object.seal(value);
        } else if (valueDefinition.extensibleMark === false) {
            Object.preventExtensions(value);
        }
    },

    generate() {
        var value = this.createValue();

        // if the created value is not a primitive put properties & attributes on it
        if (isPrimitive(value) === false) {
            this.defineProperties(value);
            this.defineAttributes(value);
        }

        return value;
    }
});

(function() {
    var PrototypeGenerator = extendConstructor(ValueGenerator, {
        constructor(prototype, generateMethod) {
            ValueGenerator.apply(this, arguments);
            this.prototype = prototype;
            this.prototypeToStringResult = Object.prototype.toString.call(prototype);
            this.generateMethod = generateMethod;
        },

        // you can fake that value is an array by doing
        // value[Symbol.toStringTag] = 'Array'
        // or
        // value[Symbol.species] = Array;
        // you can hide that value is an array by doing
        // value[Symbol.toStringTag] = 'foo';
        // or
        // value[Symbol.species] = Object
        match(valueDefinition) {
            var matched = false;

            var valueDefinitionPrototype = valueDefinition.prototype;
            if (valueDefinitionPrototype) {
                var selfPrototype = this.prototype;

                // covering most scenarios, leading to some controlled inconsistency
                if (valueDefinitionPrototype === selfPrototype) {
                    // we first check if prototype are the same
                    // if so we are sure it's the right generator for this valueDefinition
                    matched = true;
                } else if (selfPrototype.isPrototypeOf(valueDefinitionPrototype)) {
                    // then we allow people to not having to register every prototype
                    // and to set Symbol.species all the time thanks to this check on isPrototypeOf
                    // it means the following works
                    // var foo = {};
                    // var fooGenerator = ValueGenerator.registerPrototype(foo);
                    // var bar = Object.create(foo);
                    // here you dont have to do PrototypeGenerator.registerPrototype(bar) + bar[Symbol.species] = bar;
                    // because foo was registered ValueGenerator will by default match bar
                    // fooGenerator.match(bar); -> returns true
                    matched = true;
                } else if (Object.prototype.toString.call(valueDefinitionPrototype) === this.prototypeToStringResult) {
                    // for different frame we have a last resort : Object.prototype.toString
                    // we test if calling Object.prototype.toString gives the same result on both prototypes

                    // inside two frame you write
                    // var foo = {};
                    // var fooGenerator = ValueGenerator.registerPrototype(foo);

                    // then you create a foo instance in a frame
                    // var fooA = Object.create(foo);

                    // and you acess it from an other frame
                    // var fooA = frame.fooA

                    // fooGenerator.match(fooA); // false
                    // if you want it to match you must write in both frames
                    // foo[Symbol.toStringTag] = 'foo';
                    // but this is only supported in chrome as this ggist shows : https://gist.github.com/dmail/c01abe4852230aa629a127f9f63aca23

                    // however this is partially supported for native objects : Array, Object, ...
                    // so this check remains to be able to detect thoose
                    matched = true;
                } else {
                    matched = false;
                }
            } else {
                matched = false;
            }

            return matched;
        },

        generate(valueDefinition) {
            return Object.create(valueDefinition.prototype);
        }
    });

    var primitiveGenerator = extendConstructor(ValueGenerator, {
        match(valueDefinition) {
            return valueDefinition.primitiveMark === true;
        },

        generate(valueDefinition) {
            return valueDefinition.value;
        }
    });

    var arrayGenerator = PrototypeGenerator.create(Array.prototype, function(valueDefinition) {
        return new Array(valueDefinition.value.length);
    });
    var dateGenerator = PrototypeGenerator.create(Date.prototype, function(valueDefinition) {
        return new Date(valueDefinition.value.valueOf());
    });
    // consider function as primitive because creating a function clone involves eval
    // and that would impact performance VERYYYY badly
    // moreover it's not a common practice to set properties on function instance that would have to be unique
    // per object owning the function
    // see http://stackoverflow.com/questions/1833588/javascript-clone-a-function
    var functionGenerator = PrototypeGenerator.create(Function.prototype, function(valueDefinition) {
        return valueDefinition.value;
    });
    var regExpGenerator = PrototypeGenerator.create(RegExp.prototype, function(valueDefinition) {
        return new RegExp(valueDefinition.value.valueOf());
    });
    var objectGenerator = PrototypeGenerator.create(Object.prototype, function(valueDefinition) {
        return Object.create(valueDefinition.prototype);
    });
    ValueDefinitionGenerator.prototype.generators.push(
        primitiveGenerator,
        arrayGenerator,
        dateGenerator,
        functionGenerator,
        regExpGenerator,
        objectGenerator
    );
})();

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function createDefinition(value) {
            return new ValueDefinition().populate(value);
        }

        function concatValueDefinition(...args) {
            var concatenedDefinition = createDefinition(args[0]);
            args.slice(1).forEach(function(arg) {
                concatenedDefinition = concatenedDefinition.concat(createDefinition(arg));
            });
            return concatenedDefinition;
        }

        function createGenerator(valueDefinition) {
            return new ValueDefinitionGenerator(valueDefinition);
        }

        function generateFrom(...args) {
            return createGenerator(concatValueDefinition(...args)).generate();
        }

        var scan = createDefinition;

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

        this.add('concat parent', function() {
            var a = {user: {name: 'dam'}};
            var b = {user: {age: 10}};
            var definition = scan(a).concat(scan(b));
            var userValueDefinition = definition.getPropertyValueDefinition('user');
            assert(userValueDefinition.parent === definition);

            var ageValueDefinition = userValueDefinition.getPropertyValueDefinition('age');
            assert(ageValueDefinition.parent === userValueDefinition);
        });

        this.add('findReference(value)', function() {
            var value = {
                foo: 'bar',
                user: {
                    name: 'dam'
                }
            };
            var definition = scan(value);
            // var definitions = Array.from(definition.yieldValueDefinitions());
            var reference = definition.findReference(value.user);

            assert(reference.value === value.user);
        });

        this.add('references', function() {
            var value = {
                foo: true
            };
            value.self = value;
            var definition = scan(value);

            assert(definition.references.length === 1);
        });

        this.add('definition references', function() {
            var a = [];
            a.push(a, 1, a);
            var definition = createDefinition(a);
            var firstEntryDefinition = definition.getPropertyDefinition('0').valueDefinition;
            var thirdEntryDefinition = definition.getPropertyDefinition('2').valueDefinition;

            assert(firstEntryDefinition.referenceMark);
            assert(firstEntryDefinition.reference === definition);
            assert(thirdEntryDefinition.referenceMark);
            assert(thirdEntryDefinition.reference === definition);

            assert(definition.references[0] === firstEntryDefinition);
            assert(definition.references[1] === thirdEntryDefinition);
        });

        this.add('concat references', function() {
            var a = {name: 'a'};
            var b = {name: 'b'};
            b.self = b;
            var aDefinition = scan(a);
            var bDefinition = scan(b);

            assert(bDefinition.getPropertyValueDefinition('self').reference === bDefinition);

            var cDefinition = aDefinition.concat(bDefinition);
            assert(cDefinition.parent === null);
            assert(cDefinition.getPropertyValueDefinition('self').referenceMark === false);
        });

        // this.add('concatened definition references', function() {
        //     var a = {};
        //     var b = {};
        //     a.foo = a;
        //     a.bar = b;
        //     a.bat = a;
        //     b.boo = b;
        //     b.bor = a;
        //     b.bot = b;
        //     var aValueDefinition = createDefinition(a);
        //     var bValueDefinition = createDefinition(b);
        //     var definition = aValueDefinition.concat(bValueDefinition);

        //     var fooValueDefinition = definition.getPropertyDefinition('foo').valueDefinition;
        //     var barValueDefinition = definition.getPropertyDefinition('bar').valueDefinition;
        //     var batValueDefinition = definition.getPropertyDefinition('bat').valueDefinition;
        //     var booValueDefinition = definition.getPropertyDefinition('boo').valueDefinition;
        //     var borValueDefinition = definition.getPropertyDefinition('bor').valueDefinition;
        //     var botValueDefinition = definition.getPropertyDefinition('bot').valueDefinition;

        //     assert(fooValueDefinition.reference === definition);
        //     assert(barValueDefinition.reference === null); // because b was lost bar is the only one aware of b
        //     assert(batValueDefinition.reference === definition);
        //     assert(booValueDefinition.reference === barValueDefinition);
        //     assert(borValueDefinition.reference === definition);
        //     assert(botValueDefinition.reference === barValueDefinition);

        //     // IT WAS A THOUGH ONE, now the next test must do the same but mixing property because here we dont have two
        //     // property using reference, all property are unique
        //     // also try with reference nested because here we do not test
        //     // when the reference is nested just when it's in the same propertyDefinitions array level
        // });

        /*
        this.add('concatened definition nested reference', function() {
            var a = {};
            var b = {};

            a.foo = a;
            b.item = {
                boo: a,
                bat: b
            };

            var aValueDefinition = createDefinition(a);
            var bValueDefinition = createDefinition(b);
            var definition = aValueDefinition.concat(bValueDefinition);

            var fooValueDefinition = definition.getPropertyDefinition('foo').valueDefinition;
            // var barValueDefinition = definition.getPropertyDefinition('bar').valueDefinition;
            var itemValueDefinition = definition.getPropertyDefinition('item').valueDefinition;
            var booValueDefinition = itemValueDefinition.getPropertyDefinition('boo').valueDefinition;
            var batValueDefinition = itemValueDefinition.getPropertyDefinition('bat').valueDefinition;

            assert(fooValueDefinition.reference === definition);
            console.log(booValueDefinition.reference);
            assert(booValueDefinition.reference === definition);
            assert(batValueDefinition.reference === null);
        });
        */
        console.log(generateFrom);

        // this.add('concatened definition references', function() {
        //     var a = [];
        //     var b = [];
        //     a.push(a, b, a);
        //     b.push(b, a, b);
        //     var definition = concatValueDefinition(a, b);

        //     console.log(definition);
        // });

        // this.add('basic generation', function() {
        //     var value = {
        //         foo: {
        //             bar: true
        //         }
        //     };
        //     var definition = createDefinition(value);
        //     var generator = createGenerator(definition);
        //     var generated = generator.generate();

        //     assert(generated.foo.bar === true);
        //     assert(generated.foo !== value.foo); // generated object are unique
        // });

        // this.add('definition is aware of frozen/sealed/extensible', function() {
        //     var object = {};
        //     var frozenObject = Object.freeze({});
        //     var sealedObject = Object.seal({});
        //     var nonExtensibleObject = Object.preventExtensions({});

        //     var frozenDefinition = createDefinition(frozenObject);
        //     assert(frozenDefinition.frozenMark === true);
        //     assert(frozenDefinition.sealedMark === false);
        //     assert(frozenDefinition.extensibleMark === true);

        //     var sealedDefinition = createDefinition(sealedObject);
        //     assert(sealedDefinition.frozenMark === false);
        //     assert(sealedDefinition.sealedMark === true);
        //     assert(sealedDefinition.extensibleMark === true);

        //     var nonExtensibleDefinition = createDefinition(nonExtensibleObject);
        //     assert(nonExtensibleDefinition.frozenMark === false);
        //     assert(nonExtensibleDefinition.sealedMark === false);
        //     assert(nonExtensibleDefinition.extensibleMark === false);

        //     var objectDefinition = createDefinition(object);
        //     assert(objectDefinition.frozenMark === false);
        //     assert(objectDefinition.sealedMark === false);
        //     assert(objectDefinition.extensibleMark === true);
        // });

        // this.add('concatened generation ignore frozen/sealed/extensible of the concatened definition', function() {
        //     var object = {};
        //     var frozenObject = Object.freeze({});

        //     var objectDefinition = concatDefinition(object, frozenObject);
        //     assert(objectDefinition.frozenMark === false);
        //     assert(objectDefinition.sealedMark === false);
        //     assert(objectDefinition.extensibleMark === true);
        // });

        // this.add('function are handled as primitive during generation for perf reasons', function() {
        //     var value = {
        //         method() {

        //         }
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.method === value.method);
        // });

        // this.add('Date, RegExp correctly generated', function() {
        //     // how Error object behaves ? does it work?
        //     var value = {
        //         date: new Date(1990, 3, 27),
        //         regExp: /ok/
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.date.toString() === value.date.toString());
        //     assert(generated.date !== value.date);
        //     assert(generated.regExp.toString() === value.regExp.toString());
        //     assert(generated.regExp !== value.regExp);
        // });

        // this.add('Array correctly generated', function() {
        //     var value = {
        //         list: [true]
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.list instanceof Array);
        //     assert(generated.list[0] === true);
        //     assert(generated.list !== value.list);
        // });

        // this.add('custom constructor generation', function() {
        //     var constructorCallCount = 0;
        //     var Constructor = function() {
        //         constructorCallCount++;
        //         this.foo = true;
        //     };
        //     var instance = new Constructor();
        //     var value = {
        //         object: instance
        //     };
        //     var generated = generateFrom(value);

        //     assert(generated.object instanceof Constructor);
        //     assert(generated.object.foo === true);
        //     assert(constructorCallCount === 1);
        //     assert(generated.object !== value.object);
        // });

        // this.add('custom prototype generation', function() {
        //     var Prototype = {};
        //     var instance = Object.create(Prototype);
        //     var value = {
        //         object: instance
        //     };
        //     var generated = generateFrom(value);

        //     assert(Prototype.isPrototypeOf(generated.object));
        //     assert(generated.object !== value.object);
        // });

        // this.add('basic concatened generation', function() {
        //     var generated = generateFrom(
        //         {name: 'ok'},
        //         {name: 'boo', age: 10}
        //     );

        //     assert(generated.name === 'boo');
        //     assert(generated.age === 10);
        // });

        // this.add('concatened generation try to use first non primitive as receiver', function() {
        //     var generated = generateFrom(
        //         [],
        //         {foo: true}
        //     );

        //     assert(generated instanceof Array);
        //     assert(generated.foo === true);

        //     generated = generateFrom(
        //         true,
        //         {foo: true}
        //     );

        //     assert(generated instanceof Object);
        //     assert(generated.foo === true);
        // });

        // this.add('nested concatened generation', function() {
        //     var definition = concatValueDefinition(
        //         {item: {foo: true, bar: true}},
        //         {item: {bar: false, bat: true}}
        //     );
        //     var generator = createGenerator(definition);
        //     var generated = generator.generate();

        //     assert(generated.item.foo === true);
        //     assert(generated.item.bar === false);
        //     assert(generated.item.bat === true);

        //     var secondGenerated = generator.generate();
        //     assert(secondGenerated.item !== generated.item);
        //     assert.deepEqual(secondGenerated, generated);
        // });

        // this.add('frozen, sealed, preventExtension is preserved on concatened generation', function() {
        //     var value = {};
        //     Object.freeze(value);
        //     Object.seal(value);
        //     Object.preventExtensions(value);
        //     var generated = generateFrom({name: 'dam'}, value);

        //     assert(Object.isFrozen(generated) === true);
        //     assert(Object.isSealed(generated) === true);
        //     assert(Object.isExtensible(generated) === false);
        // });

        // this.add('writable, enumerable, configurable is preserved on concatened generation', function() {
        //     var dam = {};
        //     Object.defineProperty(dam, 'name', {
        //         writable: true,
        //         enumerable: false,
        //         configurable: true,
        //         value: 'dam'
        //     });
        //     var seb = {};
        //     Object.defineProperty(seb, 'name', {
        //         writable: false,
        //         enumerable: false,
        //         configurable: false,
        //         value: 'seb'
        //     });

        //     var generated = generateFrom(dam, seb);
        //     var descriptor = Object.getOwnPropertyDescriptor(generated, 'name');

        //     assert(descriptor.writable === false);
        //     assert(descriptor.enumerable === false);
        //     assert(descriptor.configurable === false);
        //     assert(descriptor.value === 'seb');
        // });

        // this.add('getter/setter are not called and correctly set on concatened generation', function() {
        //     var getterCalled = false;
        //     var setterCalled = false;
        //     var value = {
        //         get name() {
        //             getterCalled = true;
        //         },

        //         set name(value) {
        //             setterCalled = true;
        //             return value;
        //         }
        //     };
        //     var generated = generateFrom(value);
        //     var descriptor = Object.getOwnPropertyDescriptor(generated, 'name');

        //     assert(getterCalled === false);
        //     assert(setterCalled === false);
        //     assert('set' in descriptor && 'get' in descriptor);
        // });

        // this.add('setter/getter are concatened on concatened generation', function() {
        //     /* eslint-disable */
        //     var generated = generateFrom(
        //         {
        //             get name() {

        //             }
        //         },
        //         {
        //             set name(value) {
        //                 return value;
        //             }
        //         }
        //     );
        //     /* eslint-enable */
        //     var descriptor = Object.getOwnPropertyDescriptor(generated, 'name');
        //     assert('set' in descriptor && 'get' in descriptor);
        // });
    }
};

/*
collectSelfAndDescendantValueDefinition() {
        var valueDefinitions = [];

        valueDefinitions.push(this);
        this.propertyDefinitions.forEach(function(propertyDefinition) {
            var valueDefinition = propertyDefinition.valueDefinition;
            if (valueDefinition) {
                valueDefinitions.push(valueDefinition);
                valueDefinitions.push(...valueDefinition.collectSelfAndDescendantValueDefinition());
            }
        });

        return valueDefinitions;
    },

    collectPreviousValueDefinitions() {
        var valueDefinitions = [];
        var excludedValueDefinition = this;
        var parent = this.parent;

        while (parent) {
            valueDefinitions.push(parent);

            parent.propertyDefinitions.forEach(function(propertyDefinition) { // eslint-disable-line
                var valueDefinition = propertyDefinition.valueDefinition;
                if (valueDefinition && valueDefinition !== excludedValueDefinition) {
                    valueDefinitions.push(...valueDefinition.collectSelfAndDescendantValueDefinition());
                }
            });

            excludedValueDefinition = parent;
            parent = parent.parent;
        }

        return valueDefinitions;
    },

    getReference(value) {
        // un truc plus générique pour getReference serait de check que
        // les deux valueDefinition sont identiques et dans ce cas on peut dire que l'une référence l'autre
        // {writable: false, value: 10} est considéré comme une référence à {writable: true, value: 10}
        // en fait non puisque y'a l'object propertyDefinition entre les deux
        var reference = this.collectPreviousValueDefinitions().find(
            function(valueDefinition) {
                // console.log('check if', valueDefinition.value, '===', value, valueDefinition.value === value);
                return valueDefinition.hasOwnProperty('value') && valueDefinition.value === value;
            },
            this
        );

        return reference;
        // pour résumer les références doivent faire que
        // [0, 1, 0] -> [0, 1, #0]
        // [1, 0, 1] -> [1, 0, #1]
        // [0, 1, #0] concat [1, 0, #1] -> [0, 1, #0, #1, #0, #1]
        // en résumé à chaque fois que je crée une valueDéfinition je dois check parmi celels qui existent si
        // y'en a pas déjà une qui à la même valeur (pas besoin de check parmi les suivants)
        // si c'est le cas alors on crée une valueDefinition bcp plus simple qui se content de faire référence à une autre
    },
*/

/* eslint-disable no-extend-native */
// Function.prototype[createSymbol] = function() {
    // function are hard to clone, the only true way would be
    // return new Function('return ' + value.toString())();
    // but that involves eval
    // an other solution is to wrap the function into an other
    // as suggested below
    // but there is two downsides
    // - there is an anonymous function call added to stackTrace
    // - there is a wrapper function thus increasing function call cost
    // if (typeof value === 'function') {
        // var wrapper = function() {
        //     // this is important in case new is called on the function
        //     if (this instanceof wrapper) {
        //         var instance = Object.create(value.prototype);
        //         return wrapper.__clonedFrom.apply(instance, arguments);
        //     }
        //     // basic function call proxy
        //     return wrapper.__cloneFrom.apply(this, arguments);
        // };
        // wrapper.__isClone = true;
        // wrapper.__clonedFrom = value.__isClone ? value.__clonedFrom : value;
        // return wrapper;
    // }
// };
/* eslint-enable no-extend-native */

/*
var ValueGenerator = (function() {
    var ValueGenerator = createConstructor({
        constructor(...args) {
            var definitions = this.collectDefinitions(args);

            this.propertyDefinitions = [];
            this.concatAll(definitions);
        },

        collectDefinitions(values) {
            var definitions = values.map(function(value) {
                return ValueDefinition.create(value);
            });
            return definitions;
        },

        getPropertyDefinitionIndex(propertyName) {
            return this.propertyDefinitions.findIndex(function(propertyDefinition) {
                return propertyDefinition.name === propertyName;
            });
        },

        add(propertyDefinition) {
            // we keep a list of unique property definition
            var propertyDefinitionIndex = this.getPropertyDefinitionIndex(propertyDefinition.name);
            if (propertyDefinitionIndex === -1) {
                this.propertyDefinitions.push(propertyDefinition);
            } else {
                this.propertyDefinitions.splice(propertyDefinitionIndex, 1, propertyDefinition);
            }
        },

        generateValueFor(...args) {
            var generator = new this(...args);

            // now we have the generator.propertyDefinitions which is set
            // we can merge it with self property definitions
            // detecting references and doing more stuff

            // generator.parent = this;
            // generator.references = this.references; // share references with this child generator
            // return generator.produce();
            // doing generator.produce right away seems like a bad idea, we should produce the sub value on-demand
            // and not immedialty

            return generator;
        },

        concatPropertyDefinition(firstPropertyDefinition, secondPropertyDefinition) {
            var mustConcatArray = isArray(firstPropertyDefinition.owner) && isArray(secondPropertyDefinition.owner);

            if (mustConcatArray) {
                var propertyName = firstPropertyDefinition.name;
                var firstLength;
                var secondLength;

                if (propertyName === 'length') {
                    firstLength = firstPropertyDefinition.descriptor.value;
                    secondLength = secondPropertyDefinition.descriptor.value;
                    secondPropertyDefinition.descriptor.value = firstLength + secondLength;
                    return secondPropertyDefinition;
                }
                if (stringIsInteger(propertyName)) {
                    firstLength = firstPropertyDefinition.descriptor.value;
                    var freePropertyName = String(firstLength + Number(propertyName));

                    // ignore the conflict for interger properties and
                    // instead set a new definitions for the next free interger property
                    // for now consider there is no need to clone the descriptor.value because
                    // we prevent array deepCloning by default (it would be done just by canSpread below)
                    secondPropertyDefinition.name = freePropertyName;
                    return secondPropertyDefinition;
                }
            }

            // if the current property definition has a value, merge it with the existing one
            if (firstPropertyDefinition.hasValue() && secondPropertyDefinition.hasValue()) {
                if (this.canSpread(secondPropertyDefinition)) {
                    var firstPropertyDefinitionValue = firstPropertyDefinition.descriptor.value;
                    var secondPropertyDefinitionValue = secondPropertyDefinition.descriptor.value;
                    var concatenedPropertyDefinitionValue = this.generateValueFor(
                        firstPropertyDefinitionValue,
                        secondPropertyDefinitionValue
                    );

                    secondPropertyDefinitionValue.descriptor.value = concatenedPropertyDefinitionValue;
                }
            }

            return secondPropertyDefinition;
        },

        updatePropertyDefinitionValue(propertyDefinition) {
            if (propertyDefinition.hasValue()) {
                if (this.canSpread(propertyDefinition)) {
                    var propertyDefinitionValue = propertyDefinition.descriptor.value;
                    propertyDefinitionValue.descriptor.value = this.generateValueFor(propertyDefinitionValue);
                }
            }

            return propertyDefinition;
        },

        concatDefinition(firstDefinition, secondDefinition) {
            secondDefinition.propertyDefinitions.forEach(function(secondPropertyDefinition) {
                var propertyName = secondPropertyDefinition.name;
                var firstPropertyDefinition = firstDefinition.getPropertyDefinition(propertyName);
                var concatenedPropertyDefinition;

                if (firstPropertyDefinition) {
                    concatenedPropertyDefinition = this.concatPropertyDefinition(
                        firstPropertyDefinition,
                        secondPropertyDefinition
                    );
                } else {
                    concatenedPropertyDefinition = this.updatePropertyDefinitionValue(
                        secondPropertyDefinition
                    );
                }

                this.add(concatenedPropertyDefinition);
            });
        },

        concatAll(definitions) {
            var i = 1;
            var j = definitions.length;
            var previousDefinition = definitions[0];
            var definition;
            var concatenedPropertyDefinitions = this.propertyDefinitions;

            concatenedPropertyDefinitions.push(...previousDefinition.propertyDefinitions);

            for (;i < j; i++) {
                definition = definition[i];
                this.concatDefinition(previousDefinition, definition);
                previousDefinition = definition;
            }
        },

        extend(properties) {
            var extendedGenerator = Object.create(this);

            Object.assign(extendedGenerator, properties);

            return extendedGenerator;
        },

        generate() {
            throw new Error('unimplemented generate method');
        },

        canSpread() {
            throw new Error('unimplemented can spread');
        },

        refine(producedValue) {
            return producedValue;
        },

        produce() {
            // var value = this.value;
            // var producedValue;
            // var args = this.args;
            // var argsLength = args.length;

            // this.propertyDefinitions = [];

            // // primitive are not produced
            // if (isPrimitive(value)) {
            //     if (argsLength > 0) {
            //         // but we use the arguments to replace it when provided
            //         producedValue = args[argsLength - 1];
            //     } else {
            //         producedValue = value;
            //     }
            // } else {
            //     if (reference) {
            //         producedValue = reference.value;
            //     } else {
            //         producedValue = this.generate(value);
            //         references.add(value, producedValue);

            //         if (argsLength > 0 && isPrimitive(args[argsLength - 1])) {
            //             producedValue = args[argsLength - 1];
            //         } else if (isPrimitive(producedValue)) {
            //             // nothing to do
            //         } else {
            //             // we must still ensure that the clonedValue is not a primitive in case of custom clone()
            //             // if so, and if an object argument is passed we may have to throw in order to say
            //             // hey, I cannot cloneProperties of object because the clone is a primitive
            //             // in fact any object returning a primitive for clone() would throw
            //             // because the object properties could not be put after that in the resulting clone

            //             var argumentDefinitions = args.map(function(arg) {
            //                 return ValueDefinition.create(arg);
            //             });
            //             var concatenedArgumentDefinitions = this.concatDefinitions(argumentDefinitions);
            //             this.propertyDefinitions.push(...concatenedArgumentDefinitions);
            //         }
            //     }
            // }

            // propertyDefinitions.forEach(function(propertyDefinition) {
            //                 // console.log(
            //                 //     'defineProperty',
            //                 //     definition.name.toString(),
            //                 //     definition.descriptor.value,
            //                 //     'on', this.generatedValue
            //                 // );
            //                 Object.defineProperty(
            //                     producedValue,
            //                     propertyDefinition.name,
            //                     propertyDefinition.descriptor
            //                 );
            //             });

            // this.refine(producedValue);
            // return producedValue;
        }
    });

    return ValueGenerator;
})();

return ValueGenerator;
*/

/*
var cloneGenerator = ValueGenerator.extend({
    createSymbol: createSymbol,

    canSpread(propertyDefinition) {
        return isArray(propertyDefinition.owner) === false;
    },

    generate(value) {
        var generatedValue;
        var createSymbolValue = value[this.createSymbol];
        if (typeof createSymbolValue === 'function') {
            generatedValue = createSymbolValue.call(value);
        } else if (typeof value === 'function') {
            // function are not copied for perf reasons because it involves eval but we may enable this later
            generatedValue = value;
        } else if (isArray(value)) {
            // new Array(object) would work too, a copied array would be returned
            // but elements inside still have to be cloned
            generatedValue = new Array(value.length);
        } else {
            generatedValue = Object.create(Object.getPrototypeOf(value));
        }

        return generatedValue;
    },

    after(generatedValue, originalValue) {
        var originalValueIsNonExtensible = Object.isExtensible(originalValue) === false;
        var originalValueIsSealed = Object.isSealed(originalValue);
        var originalValueIsFrozen = Object.isFrozen(originalValue);

        var generatedValueMustBeNonExtensible = originalValueIsNonExtensible;
        var generatedValueMustBeSealed = originalValueIsSealed;
        var generatedValueMustBeFrozen = originalValueIsFrozen;

        var args = this.args;
        var i = args.length;
        var lastObjectArg;
        var arg;
        while (i--) {
            arg = args[i];
            if (typeof arg === 'object') {
                lastObjectArg = arg;
                break;
            }
        }

        if (lastObjectArg) {
            var hasNonExtensibleLastObjectArg = Object.isExtensible(lastObjectArg) === false;
            var hasSealedLastObjectArg = Object.isSealed(lastObjectArg);
            var hasFrozenLastObjectArg = Object.isFrozen(lastObjectArg);

            if (hasNonExtensibleLastObjectArg && generatedValueMustBeNonExtensible === false) {
                generatedValueMustBeNonExtensible = true;
            }
            if (hasSealedLastObjectArg && generatedValueMustBeSealed === false) {
                generatedValueMustBeSealed = true;
            }
            if (hasFrozenLastObjectArg && generatedValueMustBeFrozen === false) {
                generatedValueMustBeFrozen = true;
            }
        }

        if (generatedValueMustBeNonExtensible) {
            Object.preventExtensions(generatedValue);
        }
        if (generatedValueMustBeSealed) {
            Object.seal(generatedValue);
        }
        if (generatedValueMustBeFrozen) {
            Object.freeze(generatedValue);
        }

        return generatedValue;
    }
});

var extendGenerator = ValueGenerator.extend({
    canSpread(propertyDefinition) {
        return isArray(propertyDefinition.owner) === false;
    },

    generate(value) {
        var generatedValue;

        if (isArray(value)) {
            // cannot inherit from array :(
            generatedValue = value.slice();
        } else {
            generatedValue = Object.create(value);
        }

        return generatedValue;
    },

    merge(argumentDefinition, argumentIndex) {
        // if it's the first argument, because we inherit from the first argument
        // there is some change nope? we don't need to re-assign inherited properties
        // but because everything does not wants to be mutated in fact, everything must be reassigned
        // except primitives while for clone you must also reassign primitives
        // it's just a matter of performance but the result is the same
        // except you loose inheritance but noone cares once object is instancied if he got his own methods
        // or if he must get it from it's prototype
        // moreoover for function that would be way better cause you could bind them to the instance as they are not
        // the same as the one on the prototype (perf would be so bad that I let this aside for now)
        return argumentIndex;
    }
});

export {cloneGenerator, extendGenerator};
*/

// the clone & merge factory are the same, even concat Factory is the same it's just an other options
// var cloneFactory = ValueGenerator.createFactory();
// cloneFactory.parseArgs = function(args) {
//     if (args.length > 0 && isArray(args[0])) {
//         this.options.propertyNames = args[0];
//     }
// };
// var mergeFactory = ValueGenerator.createFactory();
// var concatFactory = ValueGenerator.createFactory({
//     arrayConcat: true
// });
// var extendFactory = ValueGenerator.createFactory({
//     clone: false,
//     arrayConcat: true
// });

/*
(function() {
    var implementProperty;
    if ('defineProperty' in Object) {
        var descriptor = {
            enumerable: false,
            writable: true,
            value: null
        };

        implementProperty = function(object, name, value) {
            descriptor.value = value;
            Object.defineProperty(object, name, descriptor);
        };
    } else {
        implementProperty = function(object, name, value) {
            object[name] = value;
        };
    }

    [String, Number, Boolean].forEach(function(constructor) {
        implementProperty(constructor.prototype, ValueFactory.createSymbol, function clonePrimitive() {
            return this;
        });
    });

    implementProperty(Function.prototype, ValueFactory.createSymbol, function() {
        return this;
    });

    [RegExp, Date].forEach(function(constructor) {
        implementProperty(constructor.prototype, ValueFactory.createSymbol, function cloneNative() {
            return new this.constructor(this.valueOf());
        });
    });
})();
*/

// var Item = {
//     Factory: ValueFactory,
//     createSymbol: ValueFactory.createSymbol,
//     clone: clone,
//     merge: merge,
//     concat: concat,
//     branch: branch
// };

// export default Item;

/*
export const test = {
    modules: ['@node/assert'],

    main() {
        this.add('core', function() {
            var definition = createValueDefinition({name: 'ok'});

            console.log(definition);
        });

        this.add('circular references', function() {
            ValueFactory.test = true;
            var a = {};
            a.self = a;
            var b = clone(a);

            assert.equal(a.self, a);
            assert.equal(b.self, b);
            assert.equal(a === b, false);
        });

        this.add('object have same prototype', function() {
            var a = {};
            var b = Object.create(a);
            var c = clone(b);

            assert.equal(Object.getPrototypeOf(c), a);
        });

        this.add("createSymbol property can be used for custom creation upon cloning", function() {
            var a = {
                [Item.createSymbol]: function() {
                    return 'foo';
                }
            };

            assert.equal(clone(a), 'foo');
        });

        this.add('array get non index properties', function() {
            var a = [0];
            a.foo = 'bar';
            var b = clone(a);

            assert.equal(b.foo, 'bar');
        });

        this.add('array clone their contents', function() {
            var a = [{
                [Item.createSymbol]: function() {
                    return 'foo';
                }
            }];

            assert.equal(clone(a)[0], 'foo');
        });

        this.add('cloned function share reference (are not cloned)', function() {
            var a = {
                foo: function() {}
            };
            var b = clone(a);

            assert.equal(a.foo, b.foo);
        });

        this.add("symbol property are cloned", function() {
            var fooSymbol = Symbol('foo');
            var a = {
                [fooSymbol]: true
            };
            var b = clone(a);

            assert.equal(b[fooSymbol], true);
        });

        this.add('respect writable:false', function() {
            var a = {};
            Object.defineProperty(a, 'foo', {
                enumerable: true,
                writable: false
            });
            var b = clone(a);

            assert.equal(Object.getOwnPropertyDescriptor(b, 'foo').writable, false);
        });

        this.add('respect enumerable:false', function() {
            var a = {};
            Object.defineProperty(a, 'foo', {
                enumerable: false
            });
            var b = clone(a);

            assert.equal(Object.getOwnPropertyDescriptor(b, 'foo').enumerable, false);
        });

        this.add('respect custom setter/getter', function() {
            var called = false;
            var a = {
                get foo() {
                    called = true;
                    return 'ok';
                }
            };
            var b = clone(a);

            assert.equal(called, false);
            assert.equal(b.foo, 'ok');
        });

        this.add("respect Object.freeze", function() {
            var a = {};
            Object.freeze(a);
            var b = clone(a);

            assert.equal(Object.isFrozen(b), true);
        });

        this.add('respect Object.preventExtension', function() {
            var a = {};
            Object.preventExtensions(a);
            var b = clone(a);

            assert.equal(Object.isExtensible(b), false);
        });

        this.add('respect Object.seal', function() {
            var a = {};
            Object.seal(a);
            var b = clone(a);

            assert.equal(Object.isSealed(b), true);
        });

        this.add('merge', function() {
            var a = {foo: 'foo'};
            var b = {bar: 'bar'};
            var c = merge(a, b);

            assert.deepEqual(a, {foo: 'foo'});
            assert.deepEqual(b, {bar: 'bar'});
            assert.deepEqual(c, {foo: 'foo', bar: 'bar'});
        });

        this.add("complex merge", function() {
            var a = {
                foo: true,
                item: {
                    bar: true
                }
            };
            var b = {
                foo: false,
                item: {
                    bar: false,
                    boo: true
                }
            };
            var c = merge(a, b);

            assert.deepEqual(a, {
                foo: true,
                item: {
                    bar: true
                }
            });
            assert.deepEqual(b, {
                foo: false,
                item: {
                    bar: false,
                    boo: true
                }
            });
            assert.deepEqual(c, {
                foo: false,
                item: {
                    bar: false,
                    boo: true
                }
            });
        });

        this.add("clone merge respect custom definition", function() {
            var called = false;
            var a = {foo: true};
            var b = {
                get foo() {
                    called = true;
                    return 'ok';
                }
            };

            Object.freeze(b);

            var c = merge(a, b);

            assert.equal(called, false);
            assert.equal(c.foo, 'ok');
            assert.equal(Object.isFrozen(c), true);
        });

        this.add("can concatenate array instead of merging them", function() {
            var a = ['a'];
            var b = ['b'];
            b.foo = true;
            var c = concat(a, b);

            assert.deepEqual(c, {0: 'a', 1: 'b', foo: true});
        });

        this.add("can prevent array deep cloning", function() {
            var a = [{}];
            var b = [{}];
            var c = concat(a, b);

            assert.equal(a[0] === c[0], true);
        });

        this.add('can clone a subset of properties', function() {
            var a = {name: 'dam', age: 10};
            var b = clone(a, ['age']);

            assert.deepEqual(b, {age: 10});
        });

        this.add("can merge a subset of properties", function() {
            var a = {name: 'dam'};
            var b = {name: 'john', age: 10};
            var c = merge(a, b, ['age']);

            assert.deepEqual(c, {name: 'dam', age: 10});
        });

        this.add('clone ignore property not in the cloned value', function() {
            var a = {name: 'dam', age: 10};
            var b = clone(a, ['age', 'gender']);

            assert.deepEqual(b, {age: 10});
        });

        this.add('merge ignore property not in the merged value', function() {
            var a = {name: 'dam'};
            var b = {name: 'john', age: 10};
            var c = merge(a, b, ['age', 'gender']);

            assert.deepEqual(c, {name: 'dam', age: 10});
        });

        this.add('merge respect property order', function() {
            var a = {name: true};
            var b = {name: false, age: 10};
            var c = merge(a, b);

            assert.deepEqual(Object.keys(c), ['name', 'age']);
        });

        this.add('primitive overrides', function() {
            assert.equal(merge({foo: {}}, {foo: true}).foo, true);
            assert.deepEqual(merge({foo: true}, {foo: {}}).foo, {});
            assert.equal(merge({foo: true}, {foo: false}).foo, false);
        });

        this.add('can merge an object branched by prototype', function() {
            var a = {name: 'dam', age: 10, values: [0]};
            var b = {name: 'seb', values: [1]};
            var c = branch(a, b);

            assert.equal(c.name, 'seb');
            assert.equal(c.hasOwnProperty('name'), true);
            assert.equal(c.age, 10);
            assert.equal(c.hasOwnProperty('age'), false);
            assert.deepEqual(c.values, [0, 1]);
            assert.equal(Object.getPrototypeOf(c), a);
        });

        this.add('branch deep merging', function() {
            var a = {
                foo: {
                    name: 'dam'
                },
                boo: {
                    test: true
                }
            };
            var b = {
                foo: {
                    name: 'seb',
                    bar: {
                        test: true
                    }
                }
            };

            var c = branch(a, b);

            assert.equal(c.foo.name, 'seb');
            assert.equal(c.foo.bar.test, b.foo.bar.test);
            assert.equal(c.foo.bar.hasOwnProperty('test'), false);
            assert.equal(c.hasOwnProperty('boo'), false);
            assert.equal(c.boo, a.boo);

            return assert;
        });
    }
};
*/
