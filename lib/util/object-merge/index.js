import definePropertyOf from './define.js';
import {default as clone, clonePropertyOf} from 'env/object-clone';

var getValue;
if ('getOwnPropertyDescriptor' in Object) {
    // custom setter/getter are merged without being called
    getValue = function getValue(object, name) {
        var descriptor = Object.getOwnPropertyDescriptor(object, name);
        return descriptor && 'value' in descriptor ? descriptor.value : null;
    };
} else {
    getValue = function getValue(object, name) {
        return object[name];
    };
}

var isArray = Array.isArray;

// set name in source cloning value and merging objects
function mergePropertyOf(object, name, owner) {
    var sourceValue = getValue(owner, name);
    var targetValue;

    if (typeof sourceValue === 'object' && sourceValue !== null) {
        targetValue = getValue(object, name);

        if (typeof targetValue === 'object' && targetValue !== null) {
            if (isArray(sourceValue) && isArray(targetValue)) {
                // do as if sourceValue was move to the right by the amount of item in sourceValue,
                // thus effectively mergin array together
                var sourceArray = [];
                sourceArray.push(...targetValue);
                sourceArray.push(...sourceValue);
                sourceValue = sourceArray;
            }
            object[name] = mergeProperties(targetValue, sourceValue);
        } else {
            clonePropertyOf(object, name, owner);
        }
    } else {
        definePropertyOf(object, name, owner);
    }

    return object;
}

function mergeProperties(object, source, names) {
    var i = 0;
    var j;
    var name;
    var copy = clone(object);

    if (names) {
        j = names.length;
        for (;i < j; i++) {
            name = names[i];
            if (Object.prototype.hasOwnProperty.call(source, name)) {
                mergePropertyOf(copy, name, source);
            }
        }
    } else {
        names = Object.keys(source);
        j = names.length;
        for (;i < j; i++) {
            mergePropertyOf(copy, names[i], source);
        }
    }

    return copy;
}

export {mergePropertyOf};
export default mergeProperties;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('merge returns the combination of both objects', function() {
            var a = {foo: 'foo'};
            var b = {bar: 'bar'};
            var c = mergeProperties(a, b);

            assert.deepEqual(a, {foo: 'foo'});
            assert.deepEqual(b, {bar: 'bar'});
            assert.deepEqual(c, {foo: 'foo', bar: 'bar'});
        });

        this.add("merge can merge a subset of properties", function() {
            var a = {name: 'dam'};
            var b = {name: 'john', age: 10};
            var c = mergeProperties(a, b, ['age']);

            assert.deepEqual(c, {name: 'dam', age: 10});
        });

        this.add("clone objects to keep argument untouched", function() {
            var a = {};
            var b = {
                item: {
                    name: 'item'
                }
            };
            var c = mergeProperties(a, b);

            assert.equal(c.item === b.item, false);
            assert.equal(c.item.name, 'item');
        });

        this.add('complex sample', function() {
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
            var c = mergeProperties(a, b);

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

        this.add("with array properties", function() {
            var a = {
                list: ['a']
            };
            var b = {
                list: ['b']
            };
            var c = mergeProperties(a, b);

            assert.deepEqual(c, {
                list: ['a', 'b']
            });
        });
    }
};
