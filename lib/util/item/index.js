/*

Notes:

This JavaScript file must make the fewer possible assumptions about the available js features
So that it may be runned in the largest amount of JavaScript environment
It uses an es6 syntax but one possible usage could be to compile to es5 and put it in IE8 without any polyfill required

name: Object.cloning
https://gist.github.com/NV/1396086

todo :
- ensure the attributes (frozen, sealed, extensionprevented) are applied on value once the value is created
it means doing clone(Object.freeze({}), {name: 'dam'}) must throw
- enable reference logic (prevent circular structure & perf boost when value is the same)
- allow array concatenation
- allow a custom getPropertyNames() when constructing a valueDefinition so that we only get a subset of the property definitions
- allow a custom generate()
*/

// ------ REFERENCES -----
// var sameDefinition = valueDefinition.findDefinition(function(definition) {
//     return definition.equals(this);
// }, this);
// if (sameDefinition) {
//     var reference = sameDefinition.referenceOf || sameDefinition;

//     if (reference.hasOwnProperty('references')) {
//         reference.references.push(this);
//     } else {
//         reference.references = [this];
//     }

//     this.referenceOf = reference;

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
    function createConstructor(prototype) {
        prototype.constructor.prototype = prototype;
        return prototype.constructor;
    }

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
        },

        concatDescriptor(firstDescriptor, secondDescriptor) {
            var concatenedDescriptor;
            if (secondDescriptor) {
                if (firstDescriptor) {
                    concatenedDescriptor = Object.assign({}, firstDescriptor, secondDescriptor);
                } else {
                    concatenedDescriptor = secondDescriptor;
                }
            } else {
                concatenedDescriptor = secondDescriptor;
            }
            return concatenedDescriptor;
        },

        concatValueDefinition(firstValueDefinition, secondValueDefinition) {
            var concatenedValueDefinition;
            if (secondValueDefinition) {
                if (firstValueDefinition) {
                    concatenedValueDefinition = firstValueDefinition.concat(secondValueDefinition);
                } else {
                    concatenedValueDefinition = secondValueDefinition;
                }
            } else {
                concatenedValueDefinition = secondValueDefinition;
            }
            return concatenedValueDefinition;
        },

        concat(propertyDefinition) {
            var ConcatenedConstructor = propertyDefinition.constructor;
            var concatenedName = propertyDefinition.name;
            var concatenedDescriptor = this.concatDescriptor(
                this.descriptor,
                propertyDefinition.descriptor
            );
            var concatenedValueDefinition = this.concatValueDefinition(
                this.valueDefinition,
                propertyDefinition.valueDefinition
            );
            var concatenedPropertyDefinition = new ConcatenedConstructor(
                concatenedName,
                concatenedDescriptor,
                concatenedValueDefinition
            );
            return concatenedPropertyDefinition;
        },

        generate(value) {
            return Object.create(Object.getPrototypeOf(value));
        },

        define(value) {
            var descriptor = this.descriptor;
            if (descriptor) {
                // console.log('defining', this.name, 'on', value, 'with', descriptor);
                Object.defineProperty(value, this.name, descriptor);

                var valueDefinition = this.valueDefinition;
                if (valueDefinition) {
                    var propertyValue = value[this.name];
                    value[this.name] = valueDefinition.define(propertyValue);
                    return value;
                }
            }

            return value;
        }
    });

    var ValueDefinition = createConstructor({
        constructor(value) {
            this.propertyDefinitions = [];

            if (arguments.length > 0) {
                this.value = value;

                if (this.isPrimitive() === false) {
                    var propertyNames = getPropertyNames(value);
                    propertyNames.forEach(function(propertyName) {
                        var propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
                        var propertyValueDefinition;
                        if (propertyDescriptor === null) {
                            // faudrais un object ValueDefinition qui correspond au fait que la propriété n'existe pas
                        } else if ('value' in propertyDescriptor) {
                            var propertyValue = propertyDescriptor.value;
                            if (isPrimitive(propertyValue) === false) {
                                propertyDescriptor.value = this.generate(propertyValue);
                            }
                            propertyValueDefinition = new this.constructor(propertyValue);
                        } else {
                            // faudrais un object ValueDefinition qui correspond au fait que la propriété n'a pas de valeur
                            // puisqu'elle a un getter/setter
                        }

                        var propertyDefinition = new PropertyDefinition(
                            propertyName,
                            propertyDescriptor,
                            propertyValueDefinition
                        );
                        this.propertyDefinitions.push(propertyDefinition);
                    }, this);
                }
            }
        },

        isPrimitive() {
            return isPrimitive(this.value);
        },

        getPropertyDefinition(propertyName) {
            return this.propertyDefinitions.find(function(propertyDefinition) {
                return propertyDefinition.name === propertyName;
            });
        },

        concatValue(firstValue, secondValue) {
            var concatenedValue;
            if (isPrimitive(secondValue)) {
                concatenedValue = secondValue;
            } else {
                concatenedValue = firstValue;
            }
            return concatenedValue;
        },

        concatPropertyDefinitions(firstPropertyDefinitions, secondPropertyDefinitions) {
            var concatenedPropertyDefinitions = [];

            concatenedPropertyDefinitions.push(...firstPropertyDefinitions);

            secondPropertyDefinitions.forEach(function(propertyDefinition) {
                // the code below is equivalent to Array.prototype.findIndex
                var existingPropertyDefinition;
                var propertyDefinitionIndex = concatenedPropertyDefinitions.length;
                while (propertyDefinitionIndex--) {
                    existingPropertyDefinition = concatenedPropertyDefinitions[propertyDefinitionIndex];
                    if (existingPropertyDefinition.name === propertyDefinition.name) {
                        break;
                    }
                }

                if (propertyDefinitionIndex === -1) {
                    concatenedPropertyDefinitions.push(propertyDefinition);
                } else {
                    var concatenedPropertyDefinition = existingPropertyDefinition.concat(propertyDefinition);
                    concatenedPropertyDefinitions.splice(propertyDefinitionIndex, 1, concatenedPropertyDefinition);
                }
            }, this);

            return concatenedPropertyDefinitions;
        },

        concat(valueDefinition) {
            var ConcatenedDefinitionConstructor = valueDefinition.constructor;
            var concatenedValue = this.concatValue(
                this.value,
                valueDefinition.value
            );
            var concatenedPropertyDefinitions = this.concatPropertyDefinitions(
                this.propertyDefinitions,
                valueDefinition.propertyDefinitions
            );

            var concatenedDefinition = new ConcatenedDefinitionConstructor();
            concatenedDefinition.value = concatenedValue;
            concatenedDefinition.propertyDefinitions = concatenedPropertyDefinitions;
            return concatenedDefinition;
        },

        generate(value) {
            return Object.create(Object.getPrototypeOf(value));
        },

        define() {
            var output;
            var selfValue = this.value;

            if (this.isPrimitive()) {
                output = selfValue;
            } else {
                output = this.generate(selfValue);

                this.propertyDefinitions.forEach(function(propertyDefinition) {
                    propertyDefinition.define(output);
                });
            }

            return output;
        }
    });

    return ValueDefinition;
})();

function createValueDefinition(value) {
    var valueDefinition = new ValueDefinition(value);
    return valueDefinition;
}

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            var value = {
                foo: {
                    bar: true
                }
            };
            var definition = createValueDefinition(value);
            var fooProperty = definition.getPropertyDefinition('foo');
            var barProperty = fooProperty.valueDefinition.getPropertyDefinition('bar');

            assert(fooProperty.name === 'foo');
            assert(barProperty.name === 'bar');
            // this is not true anymore, now they are empty object ready to receive the properties
            // assert(fooProperty.descriptor.value === value.foo);
            // assert(barProperty.descriptor.value === value.foo.bar);
        });

        this.add('concat', function() {
            var firstDefinition = createValueDefinition({
                name: 'ok'
            });
            var secondDefinition = createValueDefinition({
                name: 'boo',
                age: 10
            });
            var thirdDefinition = firstDefinition.concat(secondDefinition);

            var firstNameDefinition = firstDefinition.getPropertyDefinition('name');
            var thirdNameDefinition = thirdDefinition.getPropertyDefinition('name');
            var thirdAgeDefinition = thirdDefinition.getPropertyDefinition('age');

            assert(firstNameDefinition.descriptor.value === 'ok');
            assert(thirdNameDefinition.descriptor.value === 'boo');
            assert(thirdAgeDefinition.descriptor.value === 10);

            this.add('complex concat', function() {
                var firstDefinition = createValueDefinition({
                    foo: true,
                    item: {
                        bar: true
                    }
                });
                var secondDefinition = createValueDefinition({
                    foo: false,
                    item: {
                        bar: false,
                        boo: true
                    }
                });
                var thirdDefinition = firstDefinition.concat(secondDefinition);

                var generated = thirdDefinition.define({});

                // console.log(generated);

                assert(generated.foo === false);
                assert(generated.item.bar === false);
                assert(generated.item.boo === true);

                assert(generated.item !== secondDefinition.value.item);
            });
        });

        this.add('clone test', function() {
            // var user = {name: 'dam'};
            // Object.seal(user);
            // var clonedUser = clone(user, {name: 'seb'});

            // assert(Object.isSealed(clonedUser) === true);
            // assert(clonedUser.name === 'seb');

            // this.add('ensure descriptor are respected even for reference', function() {
            //     var user = {};
            //     var friend = {};

            //     Object.defineProperty(user, 'enumerableFriend', {
            //         enumerable: false,
            //         value: friend
            //     });
            //     Object.defineProperty(user, 'nonEnumerableFriend', {
            //         enumerable: true,
            //         value: friend
            //     });

            //     var clonedUser = clone(user);

            //     assert(Object.getOwnPropertyDescriptor(clonedUser, 'enumerableFriend').enumerable === true);
            //     assert(Object.getOwnPropertyDescriptor(clonedUser, 'nonEnumerableFriend').enumerable === false);
            // });
        }).skip('not ready');
    }
};

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
var createSymbol = typeof Symbol === 'undefined' ? '@@create' : Symbol('create');
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
