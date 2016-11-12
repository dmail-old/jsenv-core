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
        element.fill(value);
        return element;
    },

    match(value) {
        const ElementMatchingValue = this.findElementByValueMatch(value);
        const element = ElementMatchingValue.create(value);
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
    hooks: {
        created() {},
        added() {},
        changed() {},
        removed() {},
        childAdded() {},
        childRemoved() {}
    },

    constructor(value) {
        this.children = [];
        this.value = value;
    },

    fill() {

    },

    createNode(...args) {
        return this.createConstructor(...args);
    },

    appendChild(node) {
        return this.insertBefore(node, null);
    },

    insertBefore(node, referenceNode) {
        node.remove();
        node.parentNode = this;

        let index;
        if (referenceNode) {
            index = this.children.indexOf(referenceNode);
            if (index === -1) {
                index = this.children.length;
            }
        } else {
            index = this.children.length;
        }

        node.moveInto(this, index);

        node.hook('added');
        this.hook('childAdded', node);
    },

    moveInto(parentNode, index) {
        parentNode.children.splice(index, 0, this);
    },

    hook(name, ...args) {
        this.hooks[name].call(this, ...args);
    },

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
        return this;
    },

    replace(node) {
        const parentNode = this.parentNode;

        if (parentNode.parentNode) {
            parentNode.replaceChild(this, node);
        }

        return node;
    },

    getNextSibling() {
        const parent = this.parentNode;
        let previous = null;
        if (parent) {
            const index = parent.children.indexOf(this);
            const length = parent.children.length;
            if (index < (length - 1)) {
                previous = parent.children[index + 1];
            }
        }
        return previous;
    },

    replaceChild(supposedChildNode, node) {
        const nextNode = supposedChildNode.getNextSibling();
        this.removeChild(supposedChildNode);
        // put it at the same place (so before it's nextsibling)
        this.insertBefore(node, nextNode);
    },

    removeChild(supposedChildNode) {
        supposedChildNode.hook('removed');
        this.hook('childRemoved', supposedChildNode);
        supposedChildNode.parentNode = null;
        const index = this.children.indexOf(supposedChildNode);
        this.children.splice(index, 1);
        return supposedChildNode;
    },

    [Symbol.iterator]() {
        return this.children[Symbol.iterator]();
    }
});

const Fragment = Node.extend({
    moveInto(parentNode, index) {
        for (let childNode of this) {
            parentNode.children.splice(index, 0, childNode);
            index++;
        }
    }
});

const Element = Node.extend({
    match() {
        return false;
    },

    createFragment() {
        return Fragment.create();
    },

    extend(name, ...args) {
        const Element = util.extend.apply(this, args);
        Element.name = name;
        Lab.register(Element, this);
        return Element;
    }
});

const PrimitiveProperties = {
    referencable: false,
    compile() {
        return this.value;
    }
};
const NullPrimitiveElement = Element.extend('null', PrimitiveProperties, {
    match(value) {
        return value === null;
    }
});
const UndefinedPrimitiveElement = Element.extend('undefined', PrimitiveProperties, {
    match(value) {
        return value === undefined;
    }
});
const BooleanPrimitiveElement = Element.extend('boolean', PrimitiveProperties, {
    match(value) {
        return typeof value === 'boolean';
    }
});
const NumberPrimitiveElement = Element.extend('number', PrimitiveProperties, {
    match(value) {
        return typeof value === 'number';
    }
});
const StringPrimitiveElement = Element.extend('string', PrimitiveProperties, {
    match(value) {
        return typeof value === 'string';
    }
});
const SymbolPrimitiveElement = Element.extend('symbol', PrimitiveProperties, {
    match(value) {
        return value.constructor === Symbol;
    }
});
const ObjectElement = Element.extend('Object', {
    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype,

    fill(value) {
        Object.keys(value).forEach(function(name) {
            const propertyNode = this.createProperty(name);
            this.addProperty(propertyNode);
            propertyNode.fill(value[name]);
        }, this);
    },

    createProperty(name) {
        return ObjectPropertyElement.create(name);
    },

    addProperty(property) {
        return this.appendChild(property);
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
        const target = this.createCompilationTarget();
        for (let property of this) {
            target[property.name] = property.compile();
        }
        return target;
    },

    createCompilationTarget() {
        return {};
    }
});
// we may improve perf by splitting case (value, setter only, getter only, setter+getter)
const ObjectPropertyElement = Element.extend('ObjectProperty', {
    hooks: Object.assign(Element.hooks, {
        added() {
            if (this.syncEnabled) {
                this.parentNode.data[this.name] = this.children[0].data;
            }
        },
        removed() {
            if (this.syncEnabled) {
                delete this.parentNode.data[this.name];
            }
        }
    }),

    get name() {
        return this.value;
    },

    set name(name) {
        this.value = name;
    },

    get propertyValue() {
        const descriptor = {value: true};
        return descriptor.hasOwnProperty('value') ? this.children[0].value : undefined;
    },

    fill(value) {
        const valueNode = Lab.match(value);
        this.appendChild(valueNode);
        valueNode.fill(value);
    },

    compile() {
        return this.children[0].compile();
    }
});
function createConstructedByProperties(Constructor) {
    return {
        match(value) {
            return Constructor.prototype.isPrototypeOf(value);
        },

        createCompilationTarget() {
            return new Constructor(this.value.valueOf());
        }
    };
}
const BooleanElement = ObjectElement.extend('Boolean', createConstructedByProperties(Boolean));
const NumberElement = ObjectElement.extend('Number', createConstructedByProperties(Number));
const StringElement = ObjectElement.extend('String', createConstructedByProperties(String));
const ArrayElement = ObjectElement.extend('Array', createConstructedByProperties(Array), {
    createProperty(name) {
        return ArrayPropertyElement.create(name);
    },

    createCompilationTarget() {
        return new Array(this.value.length);
    }
});
const ArrayPropertyElement = ObjectPropertyElement.extend('ArrayProperty', {

});
// handle function as primitive because perf and impossible to share scope
const FunctionElement = ObjectElement.extend('Function',
    createConstructedByProperties(Function),
    PrimitiveProperties
);
// handle error as primitive because hard to share stack property
const ErrorElement = ObjectElement.extend('Error',
    createConstructedByProperties(Error),
    PrimitiveProperties
);
const RegExpElement = ObjectElement.extend('RegExp', createConstructedByProperties(RegExp));
const DateElement = ObjectElement.extend('Date', createConstructedByProperties(Date));
// to add : MapElement, MapEntryElement, SetElement, SetEntryElement

export {Element};
export {
    NullPrimitiveElement,
    UndefinedPrimitiveElement,
    BooleanPrimitiveElement,
    NumberPrimitiveElement,
    StringPrimitiveElement,
    SymbolPrimitiveElement
};
export {
    ObjectElement,
    ObjectPropertyElement,
    BooleanElement,
    NumberElement,
    StringElement,
    ArrayElement,
    ArrayPropertyElement,
    FunctionElement,
    ErrorElement,
    RegExpElement,
    DateElement
};
export default Lab;
