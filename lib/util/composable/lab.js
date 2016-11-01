/* eslint-disable no-use-before-define */

// https://github.com/Yomguithereal/baobab
/*
ability to resolve an element
    - must return a new tree structure in which node matching a given path are updated in some way (.resolver property is modified)

node.selectAll('foo', ['foo', 'bar']).rename('ntm'); // property foo, & nested property foo.bar renamed ntm right now

node.select('name').resolve('remove'); // property resolved by remove in case of conflict
node.select('test').resolve('rename', 'ok'); // on-conflict renamed
node.select('yo').resolve('rename', function(conflictualProperty) {}); // on-conflict dynamic rename (function must return a name)

in order to do this I must find the relevant nodes and clone them
however it means every property resolution will clone the entire tree
for now do like this

ability to record changes and undo/redo them
    - we can keep a list of operation performed by the tree and later undo it in some way
    it would allow to install the objectElement on a given target and be able to restore state
    - I suppose that being able to know the opposite of an operation requires to parse the target object into element
    - for now the operation i see are : defineProperty, deleteProperty
    we would not have a tree representing the diff or old state, just a list of operation
    and late this list could be rexecuted to undo
    it requires that I wrap all compile() stuff I suppose

make it work with array
    - ignore length property or merge them I don't know

*/
import util from './util.js';

export const test = {
    main() {

    }
};

const Lab = util.extend({
    scan(value) {
        const element = this.match(value);
        element.write(value);
        return element;
    },

    match(value) {
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
    Elements: [],

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
    },

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

const Node = util.extend({
    lifecycle: {
        created() {},
        added() {},
        changed() {},
        removed() {}
    },

    constructor() {
        this.children = [];
    },

    createNode(...args) {
        return this.createConstructor(...args);
    },

    appendChild(node) {
        node.remove();
        node.parentNode = this;
        this.children.push(node);
        node.hook('added');
        return node;
    },

    hook() {},

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
        return this;
    },

    replace(node) {
        if (this.parentNode) {
            this.parentNode.replaceChild(this, node);
        }
    },

    replaceChild(supposedChildNode, node) {
        this.removeChild(supposedChildNode);
        // put it at the same place
        this.appendChild(node);
    },

    removeChild(supposedChildNode) {
        supposedChildNode.hook('removed');
        supposedChildNode.parentNode = null;
        const index = this.children.indexOf(supposedChildNode);
        this.children.splice(index, 1);
        return supposedChildNode;
    },

    clone() {
        const clone = this.createConstructor();

        // get all property except parentNode, children and copy them (we could also delete them afterwards)
        Object.keys(this).filter(function(name) {
            return ['parentNode', 'children'].includes(name) === false;
        }).forEach(function(name) {
            clone[name] = this[name];
        }, this);

        this.children.forEach(function(child) {
            clone.appendChild(child.clone());
        }, this);

        return clone;
    },

    [Symbol.iterator]() {
        return this.children[Symbol.iterator]();
    }
});

const Element = Node.extend({
    match() {
        return false;
    },

    createFragment() {
        return this.createConstructor();
    },

    extend(name, ...args) {
        const Element = util.extend.apply(this, args);
        Element.name = name;
        Lab.register(Element, this);
        return Element;
    }
});

const ObjectElement = Element.extend('Object', {
    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype,

    write(value) {
        if (typeof value === 'object') {
            Object.keys(value).forEach(function(name) {
                const propertyNode = this.createProperty(name);
                this.addProperty(propertyNode);
                propertyNode.write(value[name]);
            }, this);
        }
        return this;
    },

    createProperty(name) {
        return ObjectPropertyElement.create(name);
    },

    addProperty(property) {
        const currentProperty = this.getProperty(property.name);
        if (currentProperty) {
            currentProperty.merge(property);
        } else {
            this.appendChild(property);
        }
    },

    hasProperty(name) {
        return this.children.some(function(property) {
            return property.name === name;
        });
    },

    getProperty(name) {
        return this.children.find(function(property) {
            return property.name === name;
        });
    },

    compile() {
        const target = {};
        for (let property of this) {
            target[property.name] = property.compile();
        }
        return target;
    }
});

// we may improve perf by splitting
const ObjectPropertyElement = Element.extend('ObjectProperty', {
    constructor(name) {
        this.name = name;
        Node.constructor.call(this);
    },

    write(value) {
        const valueNode = Lab.match(value);
        const currentValueNode = this.children[0];
        if (currentValueNode) {
            currentValueNode.replace(valueNode);
        } else {
            this.appendChild(valueNode);
        }
        valueNode.write(value);
        return this;
    },

    compile() {
        return this.children[0].compile();
    }
});

const PrimitiveProperties = {
    referencable: false,
    compile() {
        return this.data;
    },

    write(data) {
        this.data = data;
    }
};
[Boolean, Number, String].forEach(function(Constructor) {
    const constructorName = Constructor.name;
    const primitiveName = constructorName.toLowerCase();
    // const primitiveDefaultValue = new Constructor().valueOf();
    Element.extend(constructorName, PrimitiveProperties, {
        match(value) {
            return typeof value === primitiveName;
        }
    });

    // const objectName = constructorName;
    ObjectElement.extend(constructorName + 'Object', {
        prototypeValue: Constructor.prototype
    });
});
[null, undefined].forEach(function(primitiveValue) {
    Element.extend(String(primitiveValue), PrimitiveProperties, {
        match(value) {
            return value === primitiveValue;
        }
    });
});

ObjectElement.extend('Function', {
    write(data) {
        this.data = data;
    },

    compile() {
        return this.data;
    }
});
ObjectElement.extend('RegExp', {
    compile() {

    }
});
ObjectElement.extend('Date', {
    match(value) {
        return Date.prototype.isPrototypeOf(value);
    },

    write(data) {
        this.data = data;
    },

    compile() {
        return new Date(this.data);
    }
});
ObjectElement.extend('Error', {

});
ObjectElement.extend('Array', {
    match(value) {
        return Array.prototype.isPrototypeOf(value);
    }
});

export default Lab;
export {Element};
