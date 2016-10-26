/* eslint-disable no-use-before-define, new-cap */

import stampit from 'modules/stampit/dist/stampit.mjs';

const Cloneable = stampit().init(function(opts, {stamp, args}) {
    this.clone = function() {
        return stamp(...args);
    };
    // could be written stamp.bind(null, ...args);
});

const NamedEnumerable = stampit().compose(Cloneable).methods({
    count() {
        return Object.keys(this.entries).length;
    },

    has(name) {
        return this.entries.hasOwnProperty(name);
    },

    get(name) {
        return this.entries.hasOwnProperty(name) ? this.map[name] : null;
    },

    add(entry) {
        this.entries[entry.name] = entry;
        return entry;
    },

    map(fn, bind) {
        const clone = this.clone();
        for (let entry of this) {
            clone.add(fn.call(bind, entry));
        }
        return clone;
    },

    forEach(fn, bind) {
        for (let entry of this) {
            fn.call(bind, entry);
        }
    },

    [Symbol.iterator]() {
        const entries = Object.keys(this.entries).map(function(name) {
            return this.entries[name];
        }, this);

        return entries[Symbol.iterator]();
    }
}).init(function() {
    this.entries = {};
});

const Element = stampit();
const ObjectElement = Element.compose(stampit().init(function() {
    this.properties = ObjectProperties();
}));

const Properties = NamedEnumerable.compose();
const ObjectProperties = Properties.compose(stampit().methods({
    set(name, value) {
        const objectProperty = ObjectProperty();
        objectProperty.fill(name, value);
        return this.add(objectProperty);
    },

    fill(object, deep) {
        Object.keys(object).forEach(function(name) {
            const property = ObjectProperty.create(name);
            this.add(property);
            property.populate(object);
        }, this);

        if (deep) {
            let objectAncestor = Object.getPrototypeOf(object);
            while (objectAncestor) {
                Object.keys(objectAncestor).forEach(function(name) { // eslint-disable-line
                    if (this.has(name) === false) {
                        const property = ObjectProperty.create(name);
                        this.add(property);
                        property.populate(objectAncestor);
                    }
                });
                objectAncestor = Object.getPrototypeOf(objectAncestor);
            }
        }
    },

    seal() {
        return this.map(function(property) {
            return property.seal();
        });
    },

    freeze() {
        return this.map(function(property) {
            return property.freeze();
        });
    },

    define(subject) {
        return this.forEach(function(property) {
            property.define(subject);
        });
    }
}));
const ObjectProperty = stampit().compose(Cloneable).methods({
    fill(name, value) {
        this.name = name;
        this.value = value;
    },

    seal() {
        const sealedProperty = this.clone();
        // we must inherit name & value, this is a common requirement
        // a way to achieve this could be to start from the stamp
        // and add every property in this which is != from the stamp
        // does it work ? is it reliable ? should we clone, or merge the non primitive value found in this ?
        sealedProperty.name = this.name;
        sealedProperty.value = this.value;
        sealedProperty.sealed = true;
        return sealedProperty;
    },

    define(object) {
        const descriptor = this.descriptor;

        if (descriptor) {
            // console.log('define property', this.name, 'on', this.owner);
            Object.defineProperty(object, this.name, descriptor);
        } else {
            delete object.owner[this.name];
        }
    },

    populate(object) {
        if (Object.prototype.isPrototypeOf(object) === false) { // object & function allowed
            throw new TypeError('ObjectProperty caster first argument must inherit from Object.prototype');
        }

        const descriptor = Object.getOwnPropertyDescriptor(object, this.name);
        this.object = object;
        this.descriptor = descriptor;

        if ('value' in descriptor) {
            this.value = Element.scan(descriptor.value);
        } else {
            if ('get' in descriptor) {
                this.get = Element.scan(descriptor.get);
            }
            if ('set' in descriptor) {
                this.set = Element.scan(descriptor.set);
            }
        }
    }
});

// const MapElement = Element.compose(stampit().init(function() {
//     this.properties = MapProperties();
//     this.entries = MapEntries();
// }));
// const MapProperties = Properties.compose();
// const MapEntries = NamedEnumerable.compose(stampit().methods({
//     fill(mapElement, map) {
//         for (let entry of map) {
//             const mapEntry = MapEntry();
//             mapEntry.fill(entry[0], entry[1]);
//             this.add(mapEntry);
//         }
//     }
// }));
// const MapEntry = stampit().methods({
//     define(map) {
//         map.set(this.name, this.value);
//     },

//     fill(name, value) {
//         this.name = name;
//         this.value = value;
//     }
// });

const objectElement = ObjectElement();
const objectProperties = objectElement.properties;
const objectProperty = objectProperties.set('foo', true);
console.log(objectProperty);
const sealedObjectProperties = objectProperties.seal();
console.log(sealedObjectProperties);
console.log(objectProperties);
