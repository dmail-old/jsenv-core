/*

name: Object.cloning
https://gist.github.com/NV/1396086

*/

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

var clonePropertyOf;
var clonePropertiesOf;
if ('getOwnPropertyDescriptor' in Object) {
    clonePropertyOf = function(object, name, owner, references) {
        var descriptor = Object.getOwnPropertyDescriptor(owner, name);

        if ('value' in descriptor) {
            descriptor.value = cloneValue(descriptor.value, references);
        }

        Object.defineProperty(object, name, descriptor);
    };

    clonePropertiesOf = function(object, owner, references) {
        var names = Object.getOwnPropertyNames(owner);
        var i = 0;
        var j = names.length;

        for (;i < j; i++) {
            clonePropertyOf(object, names[i], owner, references);
        }

        if (!Object.isExtensible(owner)) {
            Object.preventExtensions(object);
        }
        if (Object.isSealed(owner)) {
            Object.seal(object);
        }
        if (Object.isFrozen(owner)) {
            Object.freeze(object);
        }

        return object;
    };
} else {
    clonePropertyOf = function(object, name, owner, references) {
        object[name] = cloneValue(owner[name], references);
    };

    clonePropertiesOf = function(object, owner, references) {
        var names = Object.keys(owner);
        var i = 0;
        var j = names.length;

        for (;i < j; i++) {
            clonePropertyOf(object, names[i], owner, references);
        }

        return object;
    };
}

// clone the value only if it's not a reference to a previously cloned object
function cloneValue(value, references) {
    if (references && references.has(value)) {
        value = references.values[references.index];
    } else {
        value = cloneOf(value, references);
    }
    return value;
}

function createEmptyCopy(object) {
    var copy;

    if (Object.prototype.toString.call(object) === '[object Array]') {
        // new Array(object) would work too, a copied array would be returned
        // but elements inside still have to be cloned
        copy = new Array(object.length);
    } else {
        copy = Object.create(Object.getPrototypeOf(object));
    }

    return copy;
}

function clone(object, references) {
    var copy = createEmptyCopy(object);

    references = references || new References();
    references.add(object, copy);

    return clonePropertiesOf(copy, object, references);
}

function cloneOf(object/* , references */) {
    var target;

    if (typeof object === 'object' && object !== null) {
        if (typeof object.clone === 'function') {
            target = object.clone();
        } else {
            target = clone(object);
        }
    } else {
        target = object;
    }

    return target;
}

var implementProperty;
if (Object.defineProperty) {
    var descriptor = {
        enumerable: false,
        writable: true,
        value: null
    };

    implementProperty = function(object, name, value) {
        descriptor.value = value;
        Object.defineProperty(object, String(name), descriptor);
    };
} else {
    implementProperty = function(object, name, value) {
        object[String(name)] = value;
    };
}

[String, Number, Boolean].forEach(function(constructor) {
    implementProperty(constructor.prototype, 'clone', function clonePrimitive() {
        return this;
    });
});

[RegExp, Date].forEach(function(constructor) {
    implementProperty(constructor.prototype, 'clone', function cloneNative() {
        return new this.constructor(this.valueOf());
    });
});

export {createEmptyCopy};
export {clonePropertyOf};
export default clone;

// return {
//  clonePropertyOf: clonePropertyOf,
//  clonePropertiesOf: clonePropertiesOf,
//  clone: clone
// };

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('support circular references', function() {
            var a = {};
            a.self = a;
            var b = clone(a);

            assert.equal(a.self, a);
            assert.equal(b.self, b);
            assert.equal(a === b, false);
        });

        this.add('cloned object have same prototype', function() {
            var a = {};
            var b = Object.create(a);
            var c = clone(b);

            assert.equal(Object.getPrototypeOf(c), a);
        });

        this.add('cloned array get non index properties', function() {
            var a = [0];
            a.foo = 'bar';
            var b = clone(a);

            assert.equal(b.foo, 'bar');
        });

        this.add('cloned array clone their contents', function() {
            var a = [{
                clone: function() {
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
    }
};
