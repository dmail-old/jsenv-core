/*

name: Object.cloning
https://gist.github.com/NV/1396086

*/

var isArray = Array.isArray;
const ValueFactory = (function() {
    const References = (function() {
        var References = {
            constructor: function() {
                this.objects = [];
                this.values = [];
                this.index = 0;
            },

            has: function(object) {
                this.index = this.objects.indexOf(object);
                return this.index !== -1;
            },

            add: function(object, value) {
                this.objects.push(object);
                this.values.push(value);
            }
        };
        References.constructor.prototype = References;
        References = References.constructor;

        return References;
    })();

    var createSymbol = typeof Symbol === 'undefined' ? '@@create' : Symbol('create');

    function isPrimitive(value) {
        if (value === null) {
            return true;
        }
        if (typeof value === 'object' || typeof value === 'function') {
            return false;
        }
        return true;
    }

    function stringIsInteger(string) {
        if (isNaN(string)) {
            return false;
        }
        var number = parseInt(string);
        return Number.isInteger(number);
    }

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
            implementProperty(constructor.prototype, createSymbol, function clonePrimitive() {
                return this;
            });
        });

        implementProperty(Function.prototype, createSymbol, function() {
            return this;
        });

        [RegExp, Date].forEach(function(constructor) {
            implementProperty(constructor.prototype, createSymbol, function cloneNative() {
                return new this.constructor(this.valueOf());
            });
        });
    })();

    // we use descriptor to prevent setter/getter from being called
    var PropertyDefinition = {
        constructor(name, owner) {
            if (owner === null || typeof owner !== 'object') {
                throw new TypeError(
                    'PropertyDefinition constructor second argument must be an object (not' + typeof owner + ')'
                );
            }

            this.name = name;
            this.owner = owner;
            this.descriptor = Object.getOwnPropertyDescriptor(owner, name);
        }
    };
    PropertyDefinition.constructor.prototype = PropertyDefinition;
    PropertyDefinition = PropertyDefinition.constructor;

    var ValueFactory;

    var ValueGenerator = {
        constructor(value, options) {
            this.value = value;
            this.options = options;
        },

        generate() {
            var value = this.value;
            var options = this.options;
            var references;
            if ('references' in options) {
                references = options.references;
            } else {
                references = new References();
                options.references = references;
            }

            if (references.has(value)) {
                this.generatedValue = references.values[references.index];
            } else {
                this.generatedValue = this.createValueModel();

                // console.log('value generated', this.generatedValue, 'for', value);

                // primitive are not cloned
                if (this.generatedValue === value) {
                    // but we return their mergedValue if there is one
                    if ('mergeValue' in options) {
                        this.generatedValue = options.mergeValue;
                    }
                } else if (typeof this.generatedValue === 'object' || typeof this.generatedValue === 'function') {
                    if ('mergeValue' in options && isPrimitive(options.mergeValue)) {
                        this.generatedValue = options.mergeValue;
                    } else {
                        // we must still ensure that the clonedValue is not a primitive in case of custom clone()
                        // if so, and if an object argument is passed we may have to throw in order to say
                        // hey, I cannot cloneProperties of object because the clone is a primitive
                        // in fact any object returning a primitive for clone() would throw
                        // because the object properties could not be put after that in the resulting clone
                        references.add(value, this.generatedValue);
                        this.defineProperties();
                        if (options.clone) {
                            this.defineAttributes();
                        }
                    }
                }
            }

            return this.generatedValue;
        },

        createValueModel() {
            var value = this.value;

            if (isPrimitive(value) === false) {
                if (this.options.clone) {
                    var createSymbolValue = value[createSymbol];

                    if (typeof createSymbolValue === 'function') {
                        return createSymbolValue.call(value);
                    }

                    // function are not copied for perf reasons because it involves eval but we may enable this later
                    if (typeof value === 'function') {
                        return value;
                    }

                    if (isArray(value)) {
                        // new Array(object) would work too, a copied array would be returned
                        // but elements inside still have to be cloned
                        return new Array(value.length);
                    }

                    return Object.create(Object.getPrototypeOf(value));
                }

                if (isArray(value)) {
                    // cannot inherit from array :(
                    return value.slice();
                }
                return Object.create(value);
            }

            return value;
        },

        listPropertyNames(value) {
            var propertyNames;

            propertyNames = Object.getOwnPropertyNames(value);

            if (Object.getOwnPropertySymbols) {
                propertyNames = propertyNames.concat(Object.getOwnPropertySymbols(value));
            }

            return propertyNames;
        },

        getPropertyNames(value, valueType) {
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

        createPropertyDefinition(name, owner) {
            return new PropertyDefinition(name, owner);
        },

        generateValueFor(value, options = {}) {
            var customOptions = Object.assign({}, this.options, options);
            if ('mergeValue' in options === false) {
                delete customOptions.mergeValue;
            }
            var factory = new ValueFactory(value, customOptions);
            var generatedValue = factory.generate();

            return generatedValue;
        },

        generateDefinitionValue(definition, mergeDefinition) {
            // if (mustClone === false) {
            //     console.log('options for merging', generatedValuePropertyValueGeneratorOptions);
            // }

            var definitionValue;

            if (mergeDefinition) {
                if ('value' in definition.descriptor && 'value' in mergeDefinition.descriptor) {
                    if (this.options.canSpread(definition)) {
                        definitionValue = definition.descriptor.value;
                        var mergeDefinitionValue = mergeDefinition.descriptor.value;

                        definition.descriptor.value = this.generateValueFor(definitionValue, {
                            mergeValue: mergeDefinitionValue
                        });

                        // console.log('merging',
                        //     definitionValue,
                        //     'and',
                        //     mergeDefinitionValue,
                        //     'for',
                        //     definition.name.toString(),
                        //     '->',
                        //     definition.descriptor.value
                        // );
                    } else {
                        definition.descriptor = mergeDefinition.descriptor;
                    }
                } else {
                    definition.descriptor = mergeDefinition.descriptor;
                }
            } else if ('value' in definition.descriptor) {
                if (this.options.canSpread(definition)) {
                    definitionValue = definition.descriptor.value;
                    definition.descriptor.value = this.generateValueFor(definitionValue);
                    // console.log(
                    //     'generated',
                    //     definition.descriptor.value,
                    //     'from',
                    //     definitionValue,
                    //     'for',
                    //     definition.name.toString()
                    // );
                } else {
                    // console.log('definition cannot spread', definition);
                }
            } else {
                // noop
            }
        },

        defineProperties() {
            // there is a last "issue" we must not use the descriptor.value
            // we must clone the descriptor value this is not the case here

            var value = this.value;
            var mergeValue = this.options.mergeValue;
            var mustClone = this.options.clone === true;
            var mustMerge = mergeValue && typeof mergeValue === 'object';
            var valuePropertyNames = this.getPropertyNames(this.value, 'value');
            var valueDefinitions = valuePropertyNames.map(function(valuePropertyName) {
                return this.createPropertyDefinition(valuePropertyName, value);
            }, this);
            var definitions = [];

            // when we merge we define mergeValueProperties & when there is property name conflict object are merged
            if (mustMerge) {
                var arrayConcat = this.options.arrayConcat;
                var mustConcatArray = arrayConcat && isArray(value) && isArray(mergeValue);
                var mergeValuePropertyNames = this.getPropertyNames(mergeValue, 'mergeValue');
                var mergeDefinitions = mergeValuePropertyNames.map(function(mergePropertyName) {
                    return this.createPropertyDefinition(mergePropertyName, mergeValue);
                }, this);

                if (mustConcatArray) {
                    // very important: else a mergedArray length property would is incorrect
                    // and remove the concaneted entries
                    var lengthDefinition = mergeDefinitions.find(function(mergeDefinition) {
                        return mergeDefinition.name === 'length';
                    });
                    lengthDefinition.descriptor.value = value.length + mergeValue.length;
                    // console.log('update length value because of array concat to', lengthDefinition);
                }

                mergeDefinitions.forEach(function(mergeDefinition) {
                    var existingDefinition = valueDefinitions.find(function(valueDefinition) {
                        return valueDefinition.name === mergeDefinition.name;
                    });
                    var definition;

                    // console.log('merging', mergeDefinition.name, 'conflict ?', Boolean(existingDefinition));

                    // there is a definition & a mergeDefinition for a given property name
                    if (existingDefinition) {
                        if (mustConcatArray && stringIsInteger(mergeDefinition.name)) {
                            // ignore the conflict for interger properties and
                            // instead set a new definitions for the next free interger property
                            // for now consider there is no need to clone the descriptor.value because
                            // we prevent array deepCloning by default (it would be done just by canSpread below)
                            mergeDefinition.name = String(value.length + Number(mergeDefinition.name));
                            definition = mergeDefinition;
                        } else {
                            this.generateDefinitionValue(existingDefinition, mergeDefinition);
                            definition = existingDefinition;
                        }
                    } else {
                        this.generateDefinitionValue(mergeDefinition);
                        definition = mergeDefinition;
                    }

                    definitions.push(definition);
                }, this);
            }

            if (mustClone) {
                var definitionExists = function(definitionName) {
                    return definitions.some(function(definition) {
                        return definition.name === definitionName;
                    });
                };

                // unshift all valuedefinition not in the merged definitions
                // for now harcoding reverse() + unshift() to preserve definitions assignement order
                valueDefinitions.reverse().forEach(function(valueDefinition) {
                    if (definitionExists(valueDefinition.name) === false) {
                        this.generateDefinitionValue(valueDefinition);
                        definitions.unshift(valueDefinition);
                    }
                }, this);
            }

            definitions.forEach(function(definition) {
                // console.log(
                //     'defineProperty',
                //     definition.name.toString(),
                //     definition.descriptor.value,
                //     'on', this.generatedValue
                // );
                Object.defineProperty(this.generatedValue, definition.name, definition.descriptor);
            }, this);
        },

        defineAttributes() {
            var value = this.value;
            var generatedValue = this.generatedValue;
            var mergeValue = this.options.mergeValue;

            var valueIsNonExtensible = Object.isExtensible(value) === false;
            var valueIsSealed = Object.isSealed(value);
            var valueIsFrozen = Object.isFrozen(value);
            var generatedValueMustBeNonExtensible = valueIsNonExtensible;
            var generatedValueMustBeSealed = valueIsSealed;
            var generatedValueMustBeFrozen = valueIsFrozen;
            if (mergeValue && typeof mergeValue === 'object') {
                var mergeValueIsNonExtensible = Object.isExtensible(mergeValue) === false;
                var mergeValueIsSealed = Object.isSealed(mergeValue);
                var mergeValueIsFrozen = Object.isFrozen(mergeValue);

                if (mergeValueIsNonExtensible && generatedValueMustBeNonExtensible === false) {
                    generatedValueMustBeNonExtensible = true;
                }
                if (mergeValueIsSealed && generatedValueMustBeSealed === false) {
                    generatedValueMustBeSealed = true;
                }
                if (mergeValueIsFrozen && generatedValueMustBeFrozen === false) {
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
        }
    };
    ValueGenerator.constructor.prototype = ValueGenerator;
    ValueGenerator = ValueGenerator.constructor;

    ValueFactory = {
        options: {
            clone: true,
            getValuePropertyNames: 'auto',
            arrayConcat: false,
            canSpread: 'auto', // 'auto' means true when arrayConcat is true and false on array when arrayConcat is true
            // mergeValue: undefined, do not specify mergeValue is there is nothign to merge even undefined is a valid mergeValue
            getMergeValuePropertyNames: 'auto'
        },

        constructor(value, options) {
            this.value = value;

            if (options) {
                this.options = Object.assign({}, this.options, options);
            } else {
                this.options = Object.assign({}, this.options);
            }

            var canSpreadOptionValue = this.options.canSpread;
            if (canSpreadOptionValue === 'auto') {
                if (this.options.arrayConcat === true) {
                    this.options.canSpread = function(definition) {
                        return isArray(definition.owner) === false;
                    };
                } else {
                    this.options.canSpread = function() {
                        // we could check a Symbol like isSpreadable but don't see any reason to do that for now
                        return true;
                    };
                }
            }
        },

        generate() {
            return new ValueGenerator(this.value, this.options).generate();
        }
    };
    ValueFactory.constructor.prototype = ValueFactory;
    ValueFactory = ValueFactory.constructor;
    ValueFactory.createSymbol = createSymbol;

    return ValueFactory;
})();

function clone(value, propertyNames) {
    var options = {};
    if (propertyNames) {
        options.getValuePropertyNames = propertyNames;
    }
    return new ValueFactory(value, options).generate();
}

function merge(valueA, valueB, propertyNames) {
    var options = {};
    if (arguments.length > 1) {
        options.mergeValue = valueB;
        if (propertyNames) {
            options.getMergeValuePropertyNames = propertyNames;
        }
    }

    return new ValueFactory(valueA, options).generate();
}

function concat(valueA, valueB, propertyNames) {
    var options = {};
    if (arguments.length > 1) {
        options.mergeValue = valueB;
        options.arrayConcat = true;
        if (propertyNames) {
            options.getMergeValuePropertyNames = propertyNames;
        }
    }

    return new ValueFactory(valueA, options).generate();
}

function branch(valueA, valueB) {
    var options = {};
    options.clone = false;
    if (arguments.length > 1 && valueB !== undefined) {
        options.mergeValue = valueB;
        options.arrayConcat = true;
    }

    return new ValueFactory(valueA, options).generate();
}

var Item = {
    Factory: ValueFactory,
    createSymbol: ValueFactory.createSymbol,
    clone: clone,
    merge: merge,
    concat: concat,
    branch: branch
};

export default Item;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
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
