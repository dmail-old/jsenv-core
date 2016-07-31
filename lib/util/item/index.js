/*

name: Object.cloning
https://gist.github.com/NV/1396086

here, we'll modify it for proto.extend, so make it even better in terms of readability & configurability
then add extend that will auto extend every instance of proto, also create must set [symbols.created] to true
instance created are not reextended
Array & Object should be cloned, function should too but cloning function is too expensive so le'ts consider them as primitive
also do some check to improve performance and do as if we were in an hostile js env (no polyfill etc)

*/

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

var ValueGenerator = (function() {
    function createConstructor(prototype) {
        prototype.constructor.prototype = prototype;
        return prototype.constructor;
    }

    // we use descriptor to prevent setter/getter from being called
    var PropertyDefinition = createConstructor({
        constructor(name, owner) {
            if (owner === null || typeof owner !== 'object') {
                throw new TypeError(
                    'PropertyDefinition constructor second argument must be an object (not' + typeof owner + ')'
                );
            }

            this.name = name;
            this.owner = owner;
            this.descriptor = Object.getOwnPropertyDescriptor(owner, name);
        },

        hasValue() {
            return 'value' in this.descriptor;
        }
    });

    var Reference = createConstructor({
        constructor(pointer, value) {
            this.pointer = pointer;
            this.value = value;
        }
    });

    var References = createConstructor({
        constructor() {
            this.references = [];
        },

        find(pointer) {
            return this.references.find(function(reference) {
                return reference.pointer === pointer;
            });
        },

        add(pointer, value) {
            var reference = new Reference(pointer, value);
            this.references.push(reference);
        }
    });

    var ValueGenerator = (function() {
        var stringIsInteger = function(string) {
            if (isNaN(string)) {
                return false;
            }
            var number = parseInt(string);
            return Number.isInteger(number);
        };

        // var defaultCanSpread = function() {
        //     // we could check a Symbol like isSpreadable but don't see any reason to do that for now
        //     return true;
        // };
        // var canSpreadIfNotInArray = function(definition) {
        //     return isArray(definition.owner) === false;
        // };

        // var defaultOptions = {
        //     clone: true,
        //     getValuePropertyNames: 'auto',
        //     arrayConcat: false,
        //     canSpread: 'auto', // 'auto' means true when arrayConcat is true and false on array when arrayConcat is true
        //     // mergeValue: undefined, do not specify mergeValue is there is nothign to merge even undefined is a valid mergeValue
        //     getMergeValuePropertyNames: 'auto'
        // };

        var ValueDefinition = createConstructor({
            constructor(value) {
                this.value = value;
                this.propertyDefinitions = this.createAllPropertyDefinition();
            },

            getPropertyDefinition(propertyName) {
                return this.propertyDefinitions.find(function(propertyDefinition) {
                    return propertyDefinition.name === propertyName;
                });
            },

            listPropertyNames() {
                var value = this.value;
                var propertyNames;

                if (isPrimitive(value)) {
                    propertyNames = [];
                } else {
                    propertyNames = Object.getOwnPropertyNames(value);

                    if (Object.getOwnPropertySymbols) {
                        propertyNames = propertyNames.concat(Object.getOwnPropertySymbols(value));
                    }
                }

                return propertyNames;
            },

            getPropertyNames() {
                var valueType = 'value';
                var value = this.value;
                var optionName = valueType === 'value' ? 'getValuePropertyNames' : 'getMergeValuePropertyNames';
                var optionValue = this.options[optionName];
                var propertyNames;
                var optionIsFunction = typeof optionValue === 'function';

                if (optionIsFunction) {
                    optionValue = optionValue(value);
                }

                if (optionValue === 'auto') {
                    propertyNames = this.listPropertyNames(value);
                } else if (isArray(optionValue)) {
                    propertyNames = optionValue.filter(function(propertyName) {
                        return propertyName in value;
                    });
                }

                return propertyNames;
            },

            createPropertyDefinition(name) {
                return new PropertyDefinition(name, this.value);
            },

            createAllPropertyDefinition() {
                var valuePropertyNames = this.getPropertyNames();
                var propertyDefinitions = valuePropertyNames.map(
                    this.createPropertyDefinition,
                    this
                );
                return propertyDefinitions;
            }
        });

        var ValueGenerator = createConstructor({
            constructor(...args) {
                this.args = args;
            },

            extend(properties) {
                var extendedGenerator = Object.create(this);

                Object.assign(extendedGenerator, properties);

                // var factoryOptions;
                // if (options) {
                //     factoryOptions = Object.assign({}, this.options, options);
                // } else {
                //     factoryOptions = Object.assign({}, this.options);
                // }

                // var canSpreadOptionValue = factoryOptions.canSpread;
                // if (canSpreadOptionValue === 'auto') {
                //     if (factoryOptions.arrayConcat === true) {
                //         factoryOptions.canSpread = canSpreadIfNotInArray;
                //     } else {
                //         factoryOptions.canSpread = defaultCanSpread;
                //     }
                // }

                // extendedGenerator.options = factoryOptions;

                return extendedGenerator;
            },

            generate() {
                throw new Error('unimplemented generate method');
            },

            canSpread() {
                throw new Error('unimplemented can spread');
            },

            generateValueFor(...args) {
                var generator = new this(...args);
                return generator.produce();
            },

            updateConflictualPropertyDefinition(propertyDefinition, existingPropertyDefinition) {
                var mustConcatArray = isArray(propertyDefinition.owner) && isArray(existingPropertyDefinition.owner);

                if (mustConcatArray) {
                    var existingLength;

                    if (propertyDefinition.name === 'length') {
                        existingLength = existingPropertyDefinition.descriptor.value;
                        var mergedLength = existingLength + propertyDefinition.descriptor.value;
                        propertyDefinition.descriptor.value = mergedLength;
                        return;
                    } else if (stringIsInteger(propertyDefinition.name)) {
                        existingLength = existingPropertyDefinition.descriptor.value;
                        var freePropertyName = String(existingLength + Number(propertyDefinition.name));

                        // ignore the conflict for interger properties and
                        // instead set a new definitions for the next free interger property
                        // for now consider there is no need to clone the descriptor.value because
                        // we prevent array deepCloning by default (it would be done just by canSpread below)
                        propertyDefinition.name = freePropertyName;
                        return;
                    }
                }

                // if the current property definition has a value, merge it with the existing one
                if (propertyDefinition.hasValue() && existingPropertyDefinition.hasValue()) {
                    if (this.canSpread(propertyDefinition)) {
                        var propertyDefinitionValue = propertyDefinition.descriptor.value;
                        var existingPropertyDefinitionValue = propertyDefinition.descriptor.value;
                        var mergedPropertyDefinitionValue = this.generateValueFor(
                            existingPropertyDefinitionValue,
                            propertyDefinitionValue
                        );

                        propertyDefinition.descriptor.value = mergedPropertyDefinitionValue;
                    }
                }
            },

            updatePropertyDefinitionValue(propertyDefinition) {
                if (propertyDefinition.hasValue()) {
                    if (this.options.canSpread(propertyDefinition)) {
                        var propertyDefinitionValue = propertyDefinition.descriptor.value;
                        propertyDefinitionValue.descriptor.value = this.generateValueFor(propertyDefinitionValue);
                    }
                }
            },

            mergeDefinitions(definitions) {
                var i = 1;
                var j = definitions.length;
                var previousDefinition = definitions[0];
                var definition;
                var mergedPropertyDefinitions = [];

                for (;i < j; i++) {
                    definition = definition[i];

                    // when we merge we define mergeValueProperties & when there is property name conflict object are merged
                    // eslint-disable-next-line
                    definition.propertyDefinitions.forEach(function(propertyDefinition) {
                        var propertyName = propertyDefinition.name;
                        var existingPropertyDefinition = previousDefinition.getPropertyDefinition(propertyName);

                        if (existingPropertyDefinition) {
                            this.updateConflictualPropertyDefinition(
                                propertyDefinition,
                                existingPropertyDefinition
                            );
                        } else {
                            this.updatePropertyDefinitionValue(
                                propertyDefinition
                            );
                        }

                        // we keep a list of unique property definition
                        // eslint-disable-next-line
                        var propertyDefinitionIndex = mergedPropertyDefinitions.findIndex(function(mergedPropertyDefinition) {
                            return mergedPropertyDefinition.name === propertyDefinition.name;
                        });
                        if (propertyDefinitionIndex === -1) {
                            mergedPropertyDefinitions.push(propertyDefinition);
                        } else {
                            mergedPropertyDefinitions.splice(propertyDefinitionIndex, 1, propertyDefinition);
                        }
                    });

                    previousDefinition = definition;
                }

                return mergedPropertyDefinitions;
            },

            refine(producedValue) {
                return producedValue;
            },

            produce() {
                var value = this.value;
                var producedValue;
                var args = this.args;
                var argsLength = args.length;

                // primitive are not produced
                if (isPrimitive(value)) {
                    if (argsLength > 0) {
                        // but we use the arguments to replace it when provided
                        producedValue = args[argsLength - 1];
                    } else {
                        producedValue = value;
                    }
                } else {
                    var reference;
                    var references;
                    if ('references' in this) {
                        references = this.references;
                        reference = references.find(value);
                    } else {
                        references = new References();
                        this.references = references;
                    }

                    if (reference) {
                        producedValue = reference.value;
                    } else {
                        producedValue = this.generate(value);
                        references.add(value, producedValue);

                        if (argsLength > 0 && isPrimitive(args[argsLength - 1])) {
                            producedValue = args[argsLength - 1];
                        } else if (isPrimitive(producedValue)) {
                            // nothing to do
                        } else {
                            // we must still ensure that the clonedValue is not a primitive in case of custom clone()
                            // if so, and if an object argument is passed we may have to throw in order to say
                            // hey, I cannot cloneProperties of object because the clone is a primitive
                            // in fact any object returning a primitive for clone() would throw
                            // because the object properties could not be put after that in the resulting clone

                            var argumentDefinitions = args.map(function(arg) {
                                return ValueDefinition.create(arg);
                            });
                            var propertyDefinitions = this.mergeDefinitions(argumentDefinitions);
                            propertyDefinitions.forEach(function(propertyDefinition) {
                                // console.log(
                                //     'defineProperty',
                                //     definition.name.toString(),
                                //     definition.descriptor.value,
                                //     'on', this.generatedValue
                                // );
                                Object.defineProperty(
                                    producedValue,
                                    propertyDefinition.name,
                                    propertyDefinition.descriptor
                                );
                            });
                        }
                    }
                }

                this.refine(producedValue);
                return producedValue;
            }
        });

        return ValueGenerator;
    })();

    return ValueGenerator;
})();

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

export const test = {
    modules: ['@node/assert'],

    main() {
        /*
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
        */
    }
};
