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
    constructor() {
        this.properties = Properties.create();
        Element.constructor.apply(this, arguments);
    }
});

const Properties = LinkList.extend();

ObjectElement.define({
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
        this.properties.add(property);
        property.initialize();
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
    setterElement: undefined,
    getterElement: undefined,

    constructor(objectElement, name, attributes) {
        Link.constructor.call(this, objectElement);

        this.name = name;
        this.attributes = attributes;
    },

    initialize() {
        const attributes = this.attributes;

        if ('value' in attributes) {
            // console.log('add child from value', propertyDescriptor.value);
            this.valueElement = this.createLinkedElement(attributes.value);
        } else {
            const getter = attributes.get;
            if (getter) {
                this.getterElement = this.createLinkedElement(attributes.get);
            }
            const setter = attributes.set;
            if (setter) {
                this.setterElement = this.createLinkedElement(attributes.set);
            }
        }
    }
});

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
        return this.addProperty(propertyName, attributes);
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

// next iteration methods
ObjectElement.define({
    get firstElement() {
        return this.properties.firstElement;
    }
});
ObjectPropertyLink.define({
    getElementAfter(element) {
        let next;

        if (element === this.valueElement) {
            next = this.element.properties.getNextLinkFirstElement(this);
        } else if (element === this.getterElement) {
            next = this.element.properties.getNextLinkFirstElement(this);
        } else if (element === this.getterElement) {
            next = this.setterElement;
        }

        return next;
    },

    get firstElement() {
        let first;

        if (this.hasOwnProperty('valueElement')) {
            first = this.valueElement;
        } else if (this.hasOwnProperty('getterElement')) {
            first = this.getterElement;
        } else {
            first = this.setterElement;
        }

        return first;
    }
});
// previous iteration methods
ObjectElement.define({
    get lastElement() {
        return this.properties.lastElement;
    }
});
ObjectPropertyLink.define({
    getElementBefore(element) {
        let previous;

        if (element === this.valueElement) {
            previous = this.element.properties.getPreviousLinkLastElement(this);
        } else if (element === this.getterElement) {
            previous = this.element.properties.getPreviousLinkLastElement(this);
        } else if (element === this.setterElement) {
            previous = this.getterElement;
        }

        return previous;
    },

    get lastElement() {
        let last;

        if (this.hasOwnProperty('valueElement')) {
            last = this.valueElement;
        } else if (this.hasOwnProperty('setterElement')) {
            last = this.setterElement;
        } else {
            last = this.getterElement;
        }

        return last;
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

        get lastElement() {
            return this.valueElement;
        },

        getElementBefore() {
            let previousElement;

            const previousEntryLastElement = this.element.entries.getPreviousLinkLastElement();

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
        get lastElement() {
            return this.entries.lastElement || this.properties.lastElement;
        }
    });
}

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

            let nextElements = Array.from(object.createNextElementIterable());
            assert(nextElements.length === 2);
            assert(nextElements[0].value === true);
            assert(nextElements[1].value === true);

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

