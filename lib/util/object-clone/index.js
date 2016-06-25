/*

name: Object.cloning
https://gist.github.com/NV/1396086

*/

import proto from 'env/proto';

// var isArray = Array.isArray;
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

// clone the value only if it's not a reference to a previously cloned object
function cloneValue(value, object, references) {
    var clonedValue;

    if (references && references.has(value)) {
        clonedValue = references.values[references.index];
        return clonedValue;
    }

    clonedValue = clone(value, object, references);
    return clonedValue;
}

function clonePropertyInside(emptyClone, origin, mergeObject, references, name) {
    // we use descriptor to prevent setter/getter from being called
    var originDescriptor = Object.getOwnPropertyDescriptor(origin, name);
    var originHasValue = 'value' in originDescriptor;
    var originValue = originDescriptor.value;

    var cloneMustHaveValue = originHasValue;
    var cloneMustCloneValue = originValue;
    var cloneMustCloneValueWithObject;
    var emptyClonePropertyDescriptor = originDescriptor;

    if (mergeObject && name in mergeObject) { // merging and give priority to object
        var mergeObjectDescriptor = Object.getOwnPropertyDescriptor(mergeObject, name);
        var mergeObjectHasValue = 'value' in mergeObjectDescriptor;
        var mergeObjectValue = mergeObjectDescriptor.value;

        emptyClonePropertyDescriptor = mergeObjectDescriptor;
        if (mergeObjectHasValue) {
            cloneMustHaveValue = true;

            if (originHasValue) {
                // ceci n'est vrai QUE si originValue peut être clone, c'est à dire pas primitive
                if ((typeof originValue === 'object' && originValue !== null) || typeof originValue === 'function') {
                    cloneMustCloneValue = originValue;
                    cloneMustCloneValueWithObject = mergeObjectValue;
                } else {
                    cloneMustCloneValue = mergeObjectValue;
                    cloneMustCloneValueWithObject = null;
                }
            } else {
                cloneMustCloneValue = mergeObjectValue;
                cloneMustCloneValueWithObject = null;
            }
        } else {
            cloneMustHaveValue = false;
            cloneMustCloneValue = undefined;
            cloneMustCloneValueWithObject = null;
        }
    }

    if (cloneMustHaveValue) {
        var clonedValue = cloneValue(cloneMustCloneValue, cloneMustCloneValueWithObject, references);
        emptyClonePropertyDescriptor.value = clonedValue;
    }

    // console.log('the final descriptor for', name, 'is', emptyClonePropertyDescriptor);
    Object.defineProperty(emptyClone, name, emptyClonePropertyDescriptor);
}

function clonePropertiesInside(emptyClone, origin, mergeObject, references) {
    var mustMerge = mergeObject && typeof mergeObject === 'object';
    var originPropertyNames = proto.listKeys(origin); //  Object.getOwnPropertyNames(owner); // for now let's ignore non enumerable propertie
    originPropertyNames.forEach(function(originPropertyName) {
        clonePropertyInside(emptyClone, origin, mergeObject, references, originPropertyName);
    });
    // we must also clone property of object if he got property not already in origin
    if (mustMerge) {
        var objectPropertyNames = proto.listKeys(mergeObject).filter(function(objectPropertyName) {
            return originPropertyNames.includes(objectPropertyName) === false;
        });

        objectPropertyNames.forEach(function(objectPropertyName) {
            clonePropertyInside(emptyClone, mergeObject, null, references, objectPropertyName);
        });
    }

    var originIsNonExtensible = Object.isExtensible(origin) === false;
    var originIsSealed = Object.isSealed(origin);
    var originIsFrozen = Object.isFrozen(origin);
    var cloneMustBeNonExtensible = originIsNonExtensible;
    var cloneMustBeSealed = originIsSealed;
    var cloneMustBeFrozen = originIsFrozen;
    if (mustMerge) {
        var mergeObjectIsNonExtensible = Object.isExtensible(mergeObject) === false;
        var mergeObjectIsSealed = Object.isSealed(mergeObject);
        var mergeObjectIsFrozen = Object.isFrozen(mergeObject);

        if (mergeObjectIsNonExtensible && cloneMustBeNonExtensible === false) {
            cloneMustBeNonExtensible = true;
        }
        if (mergeObjectIsSealed && cloneMustBeSealed === false) {
            cloneMustBeSealed = true;
        }
        if (mergeObjectIsFrozen && originIsFrozen === false) {
            cloneMustBeFrozen = true;
        }
    }
    if (cloneMustBeNonExtensible) {
        Object.preventExtensions(emptyClone);
    }
    if (cloneMustBeSealed) {
        Object.seal(emptyClone);
    }
    if (cloneMustBeFrozen) {
        Object.freeze(emptyClone);
    }

    return emptyClone;
}

var cloneSymbol = typeof Symbol === 'undefined' ? '@@clone' : Symbol('clone');

function createEmptyClone(value) {
    var valueType = typeof value;

    if (valueType === 'object' || valueType === 'function') {
        var cloneSymbolValue = value[cloneSymbol];

        if (typeof cloneSymbolValue === 'function') {
            return cloneSymbolValue.call(value);
        }

        // function are not copied for perf reasons because it involves eval but we may enable this later
        if (valueType === 'function') {
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
}

function clone(value, mergeValue, references) {
    var clonedValue = createEmptyClone(value);

    // primitive are not cloned
    if (clonedValue === value) {

    } else if (typeof clonedValue === 'object' || typeof clonedValue === 'function') {
        // we must still ensure that the clonedValue is not a primitive in case of custom clone()
        // if so, and if an object argument is passed we may have to throw in order to say
        // hey, I cannot cloneProperties of object because the clone is a primitive
        // in fact any object returning a primitive for clone() would throw
        // because the object properties could not be put after that in the resulting clone

        references = references || new References();
        references.add(value, clonedValue);

        clonePropertiesInside(clonedValue, value, mergeValue, references);
    }

    return clonedValue;
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

export {cloneSymbol};
export default clone;

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
                [cloneSymbol]: function() {
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
                [cloneSymbol]: function() {
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
            // it requires not to use proto.listKeys in fact we need to concatenate getOwnPropertyNames with getOwnPropertySymbols
        }).skip('not implemented yet');

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

        this.add('clone can merge', function() {
            var a = {foo: 'foo'};
            var b = {bar: 'bar'};
            var c = clone(a, b);

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
            var c = clone(a, b);

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

            var c = clone(a, b);

            assert.equal(called, false);
            assert.equal(c.foo, 'ok');
            assert.equal(Object.isFrozen(c), true);
        });

        this.add("can merge a subset of properties", function() {
            var a = {name: 'dam'};
            var b = {name: 'john', age: 10};
            var c = clone(a, b, ['age']);

            assert.deepEqual(c, {name: 'dam', age: 10});
        }).skip('cannot merge a subset of property for now');

        this.add("can concatenate array instead of merging them", function() {
            var a = {
                list: ['a']
            };
            var b = {
                list: ['b']
            };
            var c = clone(a, b);

            assert.deepEqual(c, {
                list: ['a', 'b']
            });
        }).skip('not implemented yet');
    }
};
