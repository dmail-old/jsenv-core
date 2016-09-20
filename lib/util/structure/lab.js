/* eslint-disable no-use-before-define */

import util from './util.js';

// Data, PrimitiveData -> pref this
// Variable, PrimitiveVariable
// Twin
// Mirror
// Shadow -> j'aime beaucoup shadow, dans l'idée du shadow dom en plus
// Derived
// Trace -> le meilleur je pense parce que shadow c'est trop connoté et trace c'est plus générique
// Chemistry?
// Lab ? -> j'aime ça pour laboratory
// Sandbox
// y'aurais donc Lab.scan
// Pharmacy, Atom (on a déjà Link qui sers à lié des atomes)
// Formula, Recipe, Composition
// synthesize
// https://fr.wikipedia.org/wiki/Chimie#Structure_de_la_mati.C3.A8re

// PrimitiveElement, ObjectElement
// PrimitiveMaterial, ObjectMaterial
// PrimitiveComponent, ObjectComponent
// PrimitiveElement, ObjectElement

/*
What we want first is to create an object per JavaScript value type
This is the Lab object below that will return element corresponding to value using Lab.scan(value)
*/
const Lab = util.extend({
    scan(value) {
        const element = this.from(value);
        element.initialize(value);
        return element;
    },

    from(value) {
        const ElementMatchingValue = this.findElementByValueMatch(value);
        const element = ElementMatchingValue.create();
        return element;
    },

    findElementByValueMatch(value) {
        if (arguments.length === 0) {
            throw new Error('Lab.findElementByValueMatch expect one arguments');
        }
        let ElementMatchingValue = this.Elements.find(function(Element) {
            return Element.match(value);
        });
        if (!ElementMatchingValue) {
            throw new Error('no registered element matches value ' + value);
        }
        return ElementMatchingValue;
    },
    Elements: []
});

/*
Add createElement() which can create an element of the right type using its name
*/
Lab.define({
    createElement(name, value) {
        const ElementMatchingName = this.findElementByName(name);
        const element = ElementMatchingName.create();
        if (arguments.length === 1) {
            element.initialize();
        } else {
            element.initialize(value);
        }
        return element;
    },

    findElementByName(name) {
        if (arguments.length === 0) {
            throw new Error('Lab.findElementByName expect one arguments');
        }
        let ElementUsignName = this.Elements.find(function(Element) {
            return Element.name === name;
        });
        if (!ElementUsignName) {
            throw new Error('no registered element named ' + name);
        }
        return ElementUsignName;
    }
});

/*
Create the Element object, basically it's just a wrapper to a JavaScript value
- match() method is used to know if the Element matches the value
- createDefaultValue() is usefull when Element is created without value
- extend() creates a new Element and register it inside the Lab
*/
const Element = util.extend({
    match() {

    },

    constructor() {

    },

    initialize() {
        let value;
        if (arguments.length > 0) {
            value = arguments[0];
        } else {
            value = this.createDefaultValue();
        }
        this.value = value;
        this.initializer(value);
    },

    createDefaultValue() {

    },

    initializer() {

    },

    extend(name, ...args) {
        const Element = util.extend.apply(this, args);
        Element.name = name;
        Lab.register(Element, this);
        return Element;
    }
});

/*
Add the Lab.register method
*/
Lab.define({
    register(Element, ExtendedElement) {
        let ExtendedElementIndex;

        if (ExtendedElement) {
            ExtendedElementIndex = this.Elements.indexOf(ExtendedElement);
        } else {
            ExtendedElementIndex = -1;
        }

        if (ExtendedElementIndex === -1) {
            this.Elements.push(Element);
        } else {
            this.Elements.splice(ExtendedElementIndex, 0, Element);
        }
    }
});

/*
We kown that some element will need to be linked with other element(s)
So we prepare a link property and some iteration methods
*/
Element.define({
    link: null,
    createPreviousElementIterable() {
        let element = this;

        return createIterable(function() {
            let previousElement = element.getPrevious();
            element = previousElement;

            const result = {
                done: !previousElement,
                value: previousElement
            };
            return result;
        });
    },

    getPrevious() {
        return this.link ? this.link.getPreviousElement(this) : null;
    },

    getDeepestOrSelf() {
        return this;
    },

    findPreviousElementByValue(value) {
        let previousElementUsingValue;
        for (let previousElement of this.createPreviousElementIterable()) {
            if (previousElement.value === value) {
                previousElementUsingValue = previousElement;
                break;
            }
        }
        return previousElementUsingValue;
    }
});

function createIterable(nextMethod) {
    return {
        [Symbol.iterator]: function() {
            return this;
        },
        next: nextMethod
    };
}

const Link = util.extend({
    constructor(element) {
        this.element = element;
    },
    element: null,

    createElement(value) {
        let element = Lab.from(value);

        element.link = this;

        let previousElementUsingSameValue;
        if (element.referencable) {
            previousElementUsingSameValue = element.findPreviousElementByValue(element.value);
        }

        if (previousElementUsingSameValue) {
            element.pointTo(previousElementUsingSameValue);
        } else {
            element.initialize(value);
        }

        return element;
    }
});

Element.define({
    // createPointer() {
    //     const pointerData = Trace.create(this.value);
    //     pointerData.pointTo(this);
    //     return pointerData;
    // },

    pointTo(element) {
        // here we should remove all stuff relative to populate()
        // like children and other properties created by it
        // an other way to do this would be to create a new node with only.data property
        // and to do this.replace(pointerNode)

        const pointedElement = element.pointedElement;
        if (pointedElement) {
            element = pointedElement;
        }
        this.pointedElement = element;
        element.addPointer(this);

        return this;
    },

    addPointer(pointer) {
        if (this.hasOwnProperty('pointers') === false) {
            this.pointers = [];
        }
        this.pointers.push(pointer);
    },
    pointers: []
});

/*
At this point we have Lab, Element & Link that all we to describe any JavaScript value
*/

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
    value: undefined,
    set: undefined,
    get: undefined,

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
            this.value = this.createElement(attributes.value);
        } else {
            const getter = attributes.get;
            if (getter) {
                this.get = this.createElement(attributes.get);
            }
            const setter = attributes.set;
            if (setter) {
                this.set = this.createElement(attributes.set);
            }
        }
    },

    getPreviousElement(element) {
        let previousElement;

        if (element === this.value) {
            previousElement = this.getPreviousLastElementDeepestOrSelf();
        } else if (element === this.get) {
            previousElement = this.getPreviousLastElementDeepestOrSelf();
        } else if (element === this.set) {
            previousElement = this.get.getDeepestOrSelf();
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
    },

    getLastElement() {
        let deepest;

        if (this.hasOwnProperty('value')) {
            deepest = this.value;
        } else if (this.hasOwnProperty('set')) {
            deepest = this.set;
        } else {
            deepest = this.get;
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

    const objectName = constructorName;
    ObjectElement.extend(objectName, {
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

export default Lab;

// unit test in the file are because that way they are as close as possible from what they are testing
// the next step would be to be able to declare unit test next to what they are testing
// right now they are always grouped together at the end of the file, it may change later to allow this

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Lab create Object', function() {
            let object = Lab.createElement('Object');
            let fooProperty = object.set('foo', true);
            let barProperty = object.set('bar', true);

            assert(object.properties.length === 2);
            assert(object.properties[0] === fooProperty);
            assert(object.properties[1] === barProperty);

            let previousElements = Array.from(barProperty.value.createPreviousElementIterable());
            assert(previousElements.length === 2);
            assert(previousElements[0].value === true);
            assert(previousElements[1].value === object.value);
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
