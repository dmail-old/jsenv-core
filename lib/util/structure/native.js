/* eslint-disable no-use-before-define */

import Lab from './lab.js';

const Element = Lab.Element;
const Link = Lab.Link;
const LinkList = Lab.LinkList;

/*
Let's start with JavaScript Object
*/
const ObjectElement = Element.extend('Object');

// first we define when ObjectElement matches a JavaScript value
ObjectElement.define({
    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype
});

// then we prepare ObjectElement to have his own list of link through properties
ObjectElement.define({
    referencable: true,

    createDefaultValue() {
        return {};
    },

    constructor() {
        this.properties = Properties.create();
        Element.constructor.apply(this, arguments);
    }
});

const Properties = Link.extend({
    initialize(objectElement) {
        const propertyNames = objectElement.listPropertyNames();

        propertyNames.forEach(function(name) {
            this.add(name, Object.getOwnPropertyDescriptor(objectElement.value, name));
        }, this);
    }
});

ObjectElement.define({
    listPropertyNames() {
        return Object.getOwnPropertyNames(this.value);
    }
});

const ObjectPropertyLink = Link.extend({
    name: '',
    attributes: {
        value: undefined,
        writable: true,
        configurable: true,
        enumerable: true
    },

    constructor(objectElement, name, attributes) {
        Link.constructor.call(this, objectElement);

        this.name = name;
        this.attributes = attributes;
    },

    initialize() {
        const attributes = this.attributes;

        if ('value' in attributes) {
            this.target = this.createTarget(attributes.value);
            // console.log('add child from value', propertyDescriptor.value);
            // this.valueElement = this.createLinkedElement(attributes.value);
        } else {
            const getter = attributes.get;
            const setter = attributes.set;

            if (getter && setter) {
                this.target = this.createTarget(getter, setter);
            } else if (getter) {
                this.target = this.createTarget(getter);
            } else {
                this.target = this.createTarget(setter);
            }
        }
    }
});
Properties.Link = ObjectPropertyLink;

ObjectElement.define({
    initializer() {
        this.propertiesGuardInitializer();
        this.properties.initialize(this);
    },

    propertiesGuardInitializer() {
        const value = this.value;

        if (Object.isFrozen(value)) {
            this.markAs('frozen');
        } else if (Object.isSealed(value)) {
            this.markAs('sealed');
        } else if (Object.isExtensible(value) === false) {
            this.markAs('non-extensible');
        }
    },

    markAs() {
        this.propertiesGuard = 'frozen';
    },
    propertiesGuard: 'none'
});

// get(name) {
//         return this.find(function(property) {
//             return property.name === name;
//         });
//     }

//     add(propertyName, attributes) {
//         let property = ObjectPropertyLink.create(this, propertyName, attributes);
//         this.properties.add(property);
//         property.initialize();
//         return property;
//     }

// some methods to modify the current ObjectData (add/remove/define property, make it sealed/frozen/nonExtensible)
ObjectElement.define({
    has(propertyName) {
        return propertyName in this.value;
        // return this.properties.some(function(property) {
        //     return property.name === propertyName;
        // });
    },

    get: function(propertyName) {
        return this[propertyName];
        // const property = this.properties.find(function(property) {
        //     return property.name === propertyName;
        // });
        // let propertyValue;
        // if (propertyLink) {
        //     propertyValue = propertyLink.value;
        // } else {
        //     propertyValue = undefined;
        // }
        // return propertyValue;
    },

    set: function(propertyName, value) {
        return this.defineProperty(propertyName, {
            configurable: true,
            enumerable: true,
            value: value,
            writable: true
        });
    },

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/defineProperty
    defineProperty(propertyName, attributes) {
        Object.defineProperty(this.value, propertyName, attributes);
        // create a property and add it
        return this.properties.add(propertyName, attributes);
    },

    deleteProperty(propertyName) {
        delete this.value[propertyName];
        this.removeProperty(propertyName);
    },

    removeProperty(propertyName) {
        this.properties.remove(this.properties.get(propertyName));
    },

    preventExtensions() {
        Object.preventExtensions(this.value);
        this.markAs('non-extensible');
    },

    seal() {
        Object.seal(this.value);
        this.markAs('sealed');
    },

    freeze() {
        Object.freeze(this.value);
        this.markAs('frozen');
    }
});

// iteration methods
ObjectElement.define({
    get firstElement() {
        return this.properties.firstElement;
    },

    get lastElement() {
        return this.properties.lastElement;
    }
});

/*
Now JavaScript primitives : Boolean, Number, String, null, undefined, Symbol
*/
const PrimitiveProperties = {referencable: false};

[Boolean, Number, String].forEach(function(Constructor) {
    const constructorName = Constructor.name;
    const primitiveName = constructorName.toLowerCase();
    const primitiveDefaultValue = new Constructor().valueOf();
    Element.extend(primitiveName, PrimitiveProperties, {
        match(value) {
            return typeof value === primitiveName;
        },

        createDefaultValue() {
            return primitiveDefaultValue;
        }
    });

    // const objectName = constructorName;
    ObjectElement.extend(constructorName + 'Object', {
        prototypeValue: Constructor.prototype,

        createDefaultValue() {
            return new Constructor();
        }
    });
});

[null, undefined].forEach(function(primitiveValue) {
    Element.extend(String(primitiveValue), PrimitiveProperties, {
        match(value) {
            return value === primitiveValue;
        },

        createDefaultValue() {
            return primitiveValue;
        }
    });
});

// Symbol are special
Element.extend('Symbol', PrimitiveProperties, {
    match(value) {
        return value.constructor === Symbol;
    },

    createDefaultValue() {
        return Symbol();
    }
});

// const ArrayElement = ObjectElement.extend();
// const ArrayEntryLink = ObjectProperty.extend();
// const FunctionElement = ObjectElement.extend();
// function aura besoin d'options permettant de savoir comment on génère une option depuis son modèle
// il faudras aussi wrap Function.prototype.bind pour garder une trace de la fonction d'origine
// et ne pas set la propriété non configurable name sdans certains cas et la propriété prototype ne pas y toucher ou je sais pas
// const RegExpElement = ObjectElement.extend();
// const DateElement = ObjectElement.extend();
// pour les dates ce qu'on peut imaginer c'est qu'on ait besoin d'un link genre
// creationArgumentsLink qui permet de savoir que l'object à un lien qui ne fait pas partie de ses propriétés
// mais peut/doit être utilisé lors de son instantiation -> new Date(value); au lieu de new Date()
// const ErrorElement = ObjectElement.extend();
// const SetElement = ObjectElement.extend();
// const SetEntryLink = Link.extend();
// const MapElement = ObjectElement.extend();
// const MapEntryLink = Link.extend();

if (typeof Map !== 'undefined') {
    const MapElement = ObjectElement.extend('Map', {
        Prototype: Map.prototype,

        constructor() {
            this.entries = LinkList.create();
            ObjectElement.constructor.apply(this, arguments);
        },

        createDefaultValue() {
            return new Map();
        },

        initializer() {
            this.entriesInitializer();
            ObjectElement.initializer.call(this);
        },

        entriesInitializer() {
            for (let entry of this.value.entries()) {
                this.addEntry(entry[0], entry[1]);
            }
        },

        addEntry(name, value) {
            const entry = MapEntry.create(this, name, value);
            this.entries.push(entry);
            entry.initilize();
            return entry;
        }
    });

    const MapEntry = Link.extend({
        name: '',
        valueElement: null,

        constructor(mapElement, name, value) {
            Link.constructor.call(this, mapElement);
            this.name = name;
            this.value = value;
        },

        initialize() {
            this.valueElement = this.createLinkedElement(this.value);
        },

        get firstElement() {
            return this.valueElement;
        },

        getElementAfter() {

        },

        get lastElement() {
            return this.valueElement;
        },

        getElementBefore() {
            let previousElement;

            const previousEntryLastElement = this.element.entries.getPreviousLinkLastElement(this);

            if (previousEntryLastElement) {
                previousElement = previousEntryLastElement;
            } else {
                // search now in property
                previousElement = this.element.properties.lastElement;
            }

            return previousElement;
        }
    });

    // MapElement have properties and also entries, when iterating both must be discovered
    // sachant qu'on part d'un élement qui fait partie des entries qui serais le dernier
    // l'idée c'est donc de partir de
    MapElement.define({
        get firstElement() {
            return this.properties.firstElement || this.entries.firstElement;
        },

        get lastElement() {
            return this.entries.lastElement || this.properties.lastElement;
        }
    });
}

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('create object element', function() {
            const object = Lab.createElement('Object');
            const fooProperty = object.set('foo', true);
            const barProperty = object.set('bar', {name: 'bar'});

            assert(object.properties.length === 2);
            assert(object.properties[0] === fooProperty);
            assert(object.properties[1] === barProperty);

            const foo = fooProperty.valueElement;
            const bar = barProperty.valueElement;
            const barName = bar.properties.get('name').valueElement;

            const previousElements = Array.from(barName.createPreviousElementIterable());
            assert(previousElements.length === 3);
            assert(previousElements[0] === bar);
            assert(previousElements[1] === foo);
            assert(previousElements[2] === object);

            const nextElements = Array.from(object.createNextElementIterable());
            assert(nextElements.length === 3);
            assert(nextElements[0] === foo);
            assert(nextElements[1] === bar);
            assert(nextElements[2] === barName);

            const selfProperty = object.set('self', object.value);
            const self = selfProperty.valueElement;
            assert(self.value === object.value);
            assert(self.pointedElement === object);
            assert(object.pointers.length === 1);
            assert(object.pointers[0] === self);
        });

        this.add('object shadow with pointers', function() {
            // assert(fooProperty.valueData.pointers.length === 1);
            // assert(fooProperty.valueData.pointers[0] === barProperty.valueData);
            // assert(barProperty.valueData.pointedData === fooProperty.valueData);
        });

        // this.add('primitive', function() {
        //     let node = Tree.scan(true);

        //     assert(node.data === true);
        // });

        // this.add('object', function() {
        //     let node = Tree.scan({
        //         foo: true
        //     });

        //     console.log(node);
        // });
    }
};

