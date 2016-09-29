/* eslint-disable no-use-before-define */

/*
some element are available natively
to keep the Lab & Chemistry metaphor we could name this file natural.js
and other Element will be considered Synthetic (any Object created by the user)
https://en.wikipedia.org/wiki/Synthetic_element
*/

import Lab from './lab.js';

const Element = Lab.Element;
const Constituent = Lab.Constituent;
/*
An object is composed by a list of property, each property creates a link between the object and an other value
   \____/                  \_____________/                                                       \____________/
     |                            |                                                                    |
ObjectElement       ObjectProperties & ObjectProperty                                               Element
*/
const ObjectElement = Element.extend('Object');
ObjectElement.compose(ObjectProperties);
const ObjectProperties = Constituent.extend();
ObjectProperties.compose(ObjectProperty);
const ObjectProperty = Constituent.extend();

ObjectElement.define({
    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype,
    referencable: true,

    createDefaultValue() {
        return {};
    }
});

ObjectProperties.define({
    extensible: true,

    initializer(object) {
        const propertyNames = this.listNames(object);

        propertyNames.forEach(function(name) {
            const property = this.add(name);
            this.add(property);
            property.initialize(this.element);
        }, this);

        if (Object.isExtensible(object) === false) {
            this.extensible = false;
        }
    },

    listNames(object) {
        return Object.getOwnPropertyNames(object);
    },

    createLink(name) {
        return ObjectProperty.create(name);
    },

    has(propertyName) {
        return propertyName in this.element.value;
        // return this.properties.some(function(property) {
        //     return property.name === propertyName;
        // });
    },

    get: function(propertyName) {
        return this.element[propertyName];
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
        const property = this.getProperty(propertyName) || this.add(propertyName);
        property.set(value);
        return property;
    },

    getProperty(propertyName) {
        return this.properties.find(function(property) {
            return property.name === propertyName;
        });
    },

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/defineProperty
    defineProperty(propertyName, attributes) {
        const property = this.getProperty(propertyName) || this.add(propertyName);
        property.define(attributes);
        return property;
    },

    deleteProperty(propertyName) {
        delete this.element.value[propertyName];
        this.removeProperty(this.element, propertyName);
    },

    removeProperty(propertyName) {
        this.remove(this.get(this.element, propertyName));
    },

    preventExtensions() {
        Object.preventExtensions(this.element.value);
        this.extensible = false;
        // now doing properties.add must throw
    },

    seal() {
        this.preventExtensions();
        this.properties.forEach(function(property) {
            property.seal();
        });
    },

    freeze() {
        this.preventExtensions();
        this.properties.forEach(function(property) {
            property.freeze();
        });
    },

    compositionName: 'properties',
    elementShortcut: 'properties',
    elementProperties: ['has', 'get', 'set', 'defineProperty', 'deleteProperty', 'preventExtensions', 'seal', 'freeze']
});

ObjectProperty.define({
    name: '',
    attributes: {
        value: undefined,
        writable: true,
        configurable: true,
        enumerable: true
    },

    constructor(name) {
        Constituent.call(this);
        this.name = name;
    },

    initializer(object) {
        const attributes = Object.getOwnPropertyDescriptor(object, this.name);
        this.define(attributes, true);
    },

    define(attributes, preventPropagation) {
        if (this.hasOwnProperty('attributes')) {
            // check if this.value, this.setter, this.getter becomes irrelevant
        }

        this.attributes = attributes;

        if ('value' in attributes) {
            this.value = this.link(attributes.value);
        } else {
            const getter = attributes.get;
            if (getter) {
                this.getter = this.link(getter);
            }

            const setter = attributes.set;
            if (setter) {
                this.setter = this.link(setter);
            }
        }

        if (!preventPropagation) {
            Object.defineProperty(this.parent.element.value, this.name, attributes);
        }
    },

    set: function(value) {
        return this.define({
            configurable: true,
            enumerable: true,
            value: value,
            writable: true
        });
    },

    seal() {
        const attributes = this.attributes;
        const sealedAttributes = Object.assign(attributes, {configurable: false});
        this.define(sealedAttributes);
    },

    freeze() {
        const attributes = this.attributes;
        const frozenAttributes = Object.assign(attributes, {configurable: false});
        if ('value' in attributes) {
            frozenAttributes.writable = false;
        }
        this.define(frozenAttributes);
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

/*
if (typeof Map !== 'undefined') {
    const MapElement = ObjectElement.extend('Map', {
        Prototype: Map.prototype,

        constructor() {
            this.entries = MapEntries.create();
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
                this.entries.connect(entry[0], entry[1]);
            }
        }
    });

    const MapEntries = Link.extend({

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

    MapEntries.define({
        Link: MapEntry
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
*/

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

