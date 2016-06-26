/*

name: Object.cloning
https://gist.github.com/NV/1396086

just missing arraydeepClone

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

    var cloneSymbol = typeof Symbol === 'undefined' ? '@@clone' : Symbol('clone');

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
            implementProperty(constructor.prototype, cloneSymbol, function clonePrimitive() {
                return this;
            });
        });

        implementProperty(Function.prototype, cloneSymbol, function() {
            return this;
        });

        [RegExp, Date].forEach(function(constructor) {
            implementProperty(constructor.prototype, cloneSymbol, function cloneNative() {
                return new this.constructor(this.valueOf());
            });
        });
    })();

    var ValueFactory;

    var ValueGenerator = {
        constructor(value, options) {
            this.value = value;
            this.options = options;
        },

        mustClone(value, owner) {
            var arrayDeepClone = this.options.arrayDeepClone;
            var mustClone;

            if (arrayDeepClone === false && isArray(owner)) {
                mustClone = false;
            } else {
                mustClone = true;
            }

            return mustClone;
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

                // primitive are not cloned
                if (this.generatedValue === value) {

                } else if (typeof this.generatedValue === 'object' || typeof this.generatedValue === 'function') {
                    // we must still ensure that the clonedValue is not a primitive in case of custom clone()
                    // if so, and if an object argument is passed we may have to throw in order to say
                    // hey, I cannot cloneProperties of object because the clone is a primitive
                    // in fact any object returning a primitive for clone() would throw
                    // because the object properties could not be put after that in the resulting clone

                    references.add(value, this.generatedValue);
                    this.defineProperties();
                    this.defineAttributes();
                }
            }

            return this.generatedValue;
        },

        createValueModel() {
            var value = this.value;

            if (isPrimitive(value) === false) {
                var cloneSymbolValue = value[cloneSymbol];

                if (typeof cloneSymbolValue === 'function') {
                    return cloneSymbolValue.call(value);
                }

                // function are not copied for perf reasons because it involves eval but we may enable this later
                if (typeof value === 'function') {
                    return value;
                }

                if (Object.prototype.toString.call(value) === '[object Array]') {
                    // new Array(object) would work too, a copied array would be returned
                    // but elements inside still have to be cloned
                    return new Array(value.length);
                }

                return Object.create(Object.getPrototypeOf(value));
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

            if (typeof optionValue === 'function') {
                optionValue = optionValue(value);
            }

            if (optionValue === 'auto') {
                propertyNames = this.listPropertyNames(value);
            } else if (isArray(optionValue)) {
                propertyNames = optionValue;
            }

            return propertyNames;
        },

        defineProperty(valuePropertyName, generatedValuePropertyName, mergeValuePropertyNames) {
            var value = this.value;
            var generatedValue = this.generatedValue;
            var mergeValue = this.options.mergeValue;

            // we use descriptor to prevent setter/getter from being called
            var valuePropertyDescriptor = Object.getOwnPropertyDescriptor(value, valuePropertyName);
            var valuePropertyDescriptorHasValue = 'value' in valuePropertyDescriptor;
            var valuePropertyValue = valuePropertyDescriptor.value;

            var generatedValuePropertyValueOwner = value;
            var generatedValuePropertyDescriptorMustHaveValue = valuePropertyDescriptorHasValue;
            var generatedValuePropertyValue = valuePropertyValue;
            var generatedValuePropertyMergeValue;
            var generatedValuePropertyDescriptor = valuePropertyDescriptor;

            // to support partial merging I must ensure that valuePropertyName is in the list
            if (mergeValuePropertyNames && mergeValuePropertyNames.includes(valuePropertyName) &&
                valuePropertyName in mergeValue) {
                var mergeValuePropertyDescriptor = Object.getOwnPropertyDescriptor(mergeValue, valuePropertyName);
                var mergeValuePropertyDescriptorHasValue = 'value' in mergeValuePropertyDescriptor;
                var mergeValuePropertyValue = mergeValuePropertyDescriptor.value;

                generatedValuePropertyDescriptor = mergeValuePropertyDescriptor;
                if (mergeValuePropertyDescriptorHasValue) {
                    generatedValuePropertyDescriptorMustHaveValue = true;

                    if (valuePropertyDescriptorHasValue) {
                        if (isPrimitive(valuePropertyValue)) {
                            generatedValuePropertyValue = mergeValuePropertyValue;
                            generatedValuePropertyValueOwner = mergeValue;
                            generatedValuePropertyMergeValue = null;
                        } else {
                            generatedValuePropertyValue = valuePropertyValue;
                            generatedValuePropertyMergeValue = mergeValuePropertyValue;
                        }
                    } else {
                        generatedValuePropertyValue = mergeValuePropertyValue;
                        generatedValuePropertyMergeValue = null;
                    }
                } else {
                    generatedValuePropertyDescriptorMustHaveValue = false;
                    generatedValuePropertyValue = undefined;
                    generatedValuePropertyMergeValue = null;
                }
            }

            if (generatedValuePropertyDescriptorMustHaveValue &&
                this.mustClone(generatedValuePropertyValue, generatedValuePropertyValueOwner)) {
                var generatedValuePropertyValueGeneratorOptions = Object.assign({}, this.options, {
                    mergeValue: generatedValuePropertyMergeValue
                });
                var generatedValuePropertyDescriptorValue = new ValueFactory(
                    generatedValuePropertyValue,
                    generatedValuePropertyValueGeneratorOptions
                ).generate();
                generatedValuePropertyDescriptor.value = generatedValuePropertyDescriptorValue;
            }

            // console.log('the final descriptor for', name, 'is', emptyClonePropertyDescriptor);
            Object.defineProperty(generatedValue, generatedValuePropertyName, generatedValuePropertyDescriptor);
        },

        defineProperties() {
            var value = this.value;
            var mergeValue = this.options.mergeValue;
            var mustMerge = mergeValue && typeof mergeValue === 'object';
            var arrayConcat;
            var mustConcatArray;
            var valuePropertyNames = this.getPropertyNames(value, 'value');
            var mergeValuePropertyNames;

            if (mustMerge) {
                arrayConcat = this.options.arrayConcat;
                mustConcatArray = arrayConcat && isArray(value) && isArray(mergeValue);
                mergeValuePropertyNames = this.getPropertyNames(mergeValue, 'mergeValue');

                if (mustConcatArray) {
                    // ignore the integer property to prevent merging of thoose properties
                    mergeValuePropertyNames = mergeValuePropertyNames.filter(function(mergePropertyName) {
                        return stringIsInteger(mergePropertyName) === false;
                    });
                }
            }

            valuePropertyNames.forEach(function(valuePropertyName) {
                this.defineProperty(valuePropertyName, valuePropertyName, mergeValuePropertyNames);
            }, this);

            if (mustMerge) {
                // the unhandled properties are the one in mergedValue and not in value
                var unhandledPropertyNames = mergeValuePropertyNames.filter(function(mergePropertyName) {
                    return valuePropertyNames.includes(mergePropertyName) === false;
                });

                this.options.mergeValue = null;
                this.value = mergeValue;
                unhandledPropertyNames.forEach(function(unhandledPropertyName) {
                    this.defineProperty(unhandledPropertyName, unhandledPropertyName);
                }, this);
                // for concatened array we must add all the indexes of mergeValue
                if (mustConcatArray) {
                    var i = 0;
                    var j = mergeValue.length;
                    for (;i < j; i++) {
                        var movedIndex = value.length + i;
                        this.defineProperty(i, String(movedIndex));
                    }
                }
                this.options.mergeValue = mergeValue;
                this.value = value;
            }
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
            getValuePropertyNames: 'auto',
            arrayConcat: false,
            // arrayDeepClone: true, is autoset to the opposie of arrayConcat when absent
            mergeValue: null,
            getMergeValuePropertyNames: 'auto'
        },

        constructor(value, options) {
            this.value = value;

            if (options) {
                this.options = Object.assign({}, this.options, options);
            } else {
                this.options = Object.assign({}, this.options);
            }

            if (('arrayDeepClone' in this.options) === false) {
                this.options.arrayDeepClone = !this.options.arrayConcat;
            }
        },

        generate() {
            return new ValueGenerator(this.value, this.options).generate();
        }
    };
    ValueFactory.constructor.prototype = ValueFactory;
    ValueFactory = ValueFactory.constructor;
    ValueFactory.cloneSymbol = cloneSymbol;

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
    options.mergeValue = valueB;
    if (propertyNames) {
        options.getMergeValuePropertyNames = propertyNames;
    }

    return new ValueFactory(valueA, options).generate();
}

function concat(valueA, valueB, propertyNames) {
    var options = {};
    options.mergeValue = valueB;
    options.arrayConcat = true;
    if (propertyNames) {
        options.getMergeValuePropertyNames = propertyNames;
    }

    return new ValueFactory(valueA, options).generate();
}

var api = {
    Factory: ValueFactory,
    symbol: ValueFactory.cloneSymbol,
    clone: clone,
    merge: merge,
    concat: concat
};

export default api;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('circular references', function() {
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

        this.add("cloneSymbol property can be used for custom clone", function() {
            var a = {
                [api.symbol]: function() {
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
                [api.symbol]: function() {
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
    }
};
