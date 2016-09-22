/* eslint-disable no-use-before-define */

import Lab from './lab.js';

const Element = Lab.Element;
const Link = Lab.Link;

/*
Let's start with JavaScript Object
*/
const ObjectElement = Element.extend('Object', {
    referencable: true,
    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype,

    constructor() {
        this.properties = [];
        Element.constructor.apply(this, arguments);
    },

    createDefaultValue() {
        return {};
    },

    initializer() {
        this.propertiesGuardInitializer();
        this.propertiesInitializer();
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
    propertiesGuard: 'none',

    propertiesInitializer() {
        const propertyNames = this.listPropertyNames();

        propertyNames.forEach(function(name) {
            this.addProperty(name, Object.getOwnPropertyDescriptor(this.value, name));
        }, this);
    },

    listPropertyNames() {
        return Object.getOwnPropertyNames(this.value);
    },

    addProperty(propertyName, attributes) {
        let property = ObjectPropertyLink.create(this, propertyName, attributes);
        return property;
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
    valueElement: undefined,
    setElement: undefined,
    getElement: undefined,

    constructor(objectElement, name, attributes) {
        Link.constructor.call(this, objectElement);

        this.name = name;
        this.attributes = attributes;
        objectElement.properties.push(this);
        this.initialize();
    },

    initialize() {
        const attributes = this.attributes;

        if ('value' in attributes) {
            // console.log('add child from value', propertyDescriptor.value);
            this.valueElement = this.createLinkedElement(attributes.value);
        } else {
            const getter = attributes.get;
            if (getter) {
                this.getElement = this.createLinkedElement(attributes.get);
            }
            const setter = attributes.set;
            if (setter) {
                this.setElement = this.createLinkedElement(attributes.set);
            }
        }
    },

    getLastElement() {
        let last;

        if (this.hasOwnProperty('valueElement')) {
            last = this.valueElement;
        } else if (this.hasOwnProperty('setElement')) {
            last = this.setElement;
        } else {
            last = this.getElement;
        }

        return last;
    },

    getPreviousElement(element) {
        let previousElement;

        if (element === this.valueElement) {
            previousElement = this.getPreviousLastElementDeepestOrSelf();
        } else if (element === this.getEement) {
            previousElement = this.getPreviousLastElementDeepestOrSelf();
        } else if (element === this.setElement) {
            previousElement = this.getElement.getDeepestOrSelf();
        }

        return previousElement;
    },

    getPreviousLastElementDeepestOrSelf() {
        let deepest;

        const element = this.element;
        const properties = element.properties;
        const propertyIndex = properties.indexOf(this);

        if (propertyIndex === -1) {
            throw new Error(this + 'not found in its objectElement.properties');
        }
        if (propertyIndex === 0) {
            deepest = element;
        } else {
            const previousProperty = properties[propertyIndex - 1];
            deepest = previousProperty.getLastElement().getDeepestOrSelf();
        }

        return deepest;
    }
});

// some methods to modify the current ObjectData (add/remove/define property, make it sealed/frozen/nonExtensible)
ObjectElement.define({
    getDeepestOrSelf() {
        let deepestOrSelf;

        const properties = this.properties;
        const propertiesLength = properties.length;
        if (propertiesLength === 0) {
            deepestOrSelf = this;
        } else {
            const lastProperty = properties[propertiesLength - 1];
            const lastPropertyLastElement = lastProperty.getLastElement();

            if (lastPropertyLastElement) {
                const lastPropertyLastElementDeepestElement = lastPropertyLastElement.getDeepestOrSelf();
                deepestOrSelf = lastPropertyLastElementDeepestElement;
            }
        }

        return deepestOrSelf;
    },

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
        return this.addProperty(propertyName, attributes);
    },

    deleteProperty(propertyName) {
        delete this.value[propertyName];
        this.removeProperty(propertyName);
    },

    removeProperty(propertyName) {
        const propertyIndex = this.properties.findIndex(function(property) {
            return property.name === propertyName;
        });
        this.links.splice(propertyIndex, 1);
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

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('create object element', function() {
            let object = Lab.createElement('Object');
            let fooProperty = object.set('foo', true);
            let barProperty = object.set('bar', true);

            assert(object.properties.length === 2);
            assert(object.properties[0] === fooProperty);
            assert(object.properties[1] === barProperty);

            let previousElements = Array.from(barProperty.valueElement.createPreviousElementIterable());
            assert(previousElements.length === 2);
            assert(previousElements[0].value === true);
            assert(previousElements[1].value === object.value);

            var selfProperty = object.set('self', object.value);
            var selfPropertyValueElement = selfProperty.valueElement;
            assert(selfPropertyValueElement.value === object.value);
            assert(selfPropertyValueElement.pointedElement === object);
            assert(object.pointers.length === 1);
            assert(object.pointers[0] === selfPropertyValueElement);
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

