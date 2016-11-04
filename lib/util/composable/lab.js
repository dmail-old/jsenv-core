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
    hooks: {
        created() {},
        added() {},
        changed() {},
        removed() {},
        childAdded() {},
        childRemoved() {}
    },

    constructor() {
        this.children = [];
        this.data = this.createDefaultData();
    },

    createDefaultData() {},

    fill(data) {
        this.data = data;
        this.disableSync();
        this.populate();
        this.enableSync();
    },

    disableSync() {
        this.syncEnabled = false;
    },
    syncEnabled: true,

    populate() {

    },

    enableSync() {
        this.syncEnabled = true;
    },

    createNode(...args) {
        return this.createConstructor(...args);
    },

    appendChild(node) {
        node.remove();
        node.parentNode = this;
        this.children.push(node);
        node.hook('added');
        this.hook('childAdded', node);
        return node;
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
        if (this.parentNode) {
            this.parentNode.replaceChild(this, node);
        } else {
            node.appendChild(this);
        }
        return node;
    },

    replaceChild(supposedChildNode, node) {
        this.removeChild(supposedChildNode);
        // put it at the same place
        this.appendChild(node);
    },

    removeChild(supposedChildNode) {
        supposedChildNode.hook('removed');
        this.hook('childRemoved', supposedChildNode);
        supposedChildNode.parentNode = null;
        const index = this.children.indexOf(supposedChildNode);
        this.children.splice(index, 1);
        return supposedChildNode;
    },

    clone(deep = true) {
        const clone = this.createConstructor();

        // get all property except parentNode, children and copy them (we could also delete them afterwards)
        Object.keys(this).filter(function(name) {
            return ['parentNode', 'children'].includes(name) === false;
        }).forEach(function(name) {
            clone[name] = this[name];
        }, this);

        if (deep) {
            this.children.forEach(function(child) {
                clone.appendChild(child.clone());
            }, this);
        }

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
        return this.data;
    }
};
const NullElement = Element.extend('Null', PrimitiveProperties, {
    match(value) {
        return value === null;
    }
});
const UndefinedElement = Element.extend('Undefined', PrimitiveProperties, {
    match(value) {
        return value === undefined;
    }
});
const BooleanElement = Element.extend('Boolean', PrimitiveProperties, {
    match(value) {
        return typeof value === 'boolean';
    }
});
const NumberElement = Element.extend('Number', PrimitiveProperties, {
    match(value) {
        return typeof value === 'number';
    }
});
const StringElement = Element.extend('String', PrimitiveProperties, {
    match(value) {
        return typeof value === 'string';
    }
});
const SymbolElement = Element.extend('Symbol', PrimitiveProperties, {
    match(value) {
        return value.constructor === Symbol;
    }
});
const ObjectElement = Element.extend('Object', {
    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype,

    populate() {
        Object.keys(this.data).forEach(function(name) {
            const propertyNode = this.createProperty(name);
            this.addProperty(propertyNode);
            propertyNode.fill(this.data[name]);
        }, this);
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

    constructor(name) {
        this.name = name;
        Node.constructor.call(this);
    },

    populate() {
        const valueNode = Lab.match(this.data);
        const currentValueNode = this.children[0];
        if (currentValueNode) {
            currentValueNode.replace(valueNode);
        } else {
            this.appendChild(valueNode);
        }
        valueNode.fill(this.data);
        return this;
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

        createDefaultData() {
            return new Constructor();
        },

        createCompilationTarget() {
            return new Constructor(this.data.valueOf());
        }
    };
}
const BooleanObjectElement = ObjectElement.extend('BooleanObject', createConstructedByProperties(Boolean));
const NumberObjectElement = ObjectElement.extend('NumberObject', createConstructedByProperties(Number));
const StringObjectElement = ObjectElement.extend('StringObject', createConstructedByProperties(String));
const ArrayObjectElement = ObjectElement.extend('ArrayObject', createConstructedByProperties(Array), {
    createCompilationTarget() {
        return new Array(this.data.length);
    }
});
// handle function as primitive because perf and impossible to share scope
const FunctionObjectElement = ObjectElement.extend('FunctionObject',
    createConstructedByProperties(Function),
    PrimitiveProperties
);
// handle error as primitive because hard to share stack property
const ErrorObjectElement = ObjectElement.extend('ErrorObject',
    createConstructedByProperties(Error),
    PrimitiveProperties
);
const RegExpObjectElement = ObjectElement.extend('RegExpObject', createConstructedByProperties(RegExp));
const DateObjectElement = ObjectElement.extend('DateObject', createConstructedByProperties(Date));
// to add : MapElement, MapEntryElement, SetElement, SetEntryElement

export {Element};
export {
    NullElement,
    UndefinedElement,
    BooleanElement,
    NumberElement,
    StringElement,
    SymbolElement
};
export {
    ObjectElement,
    ObjectPropertyElement,
    BooleanObjectElement,
    NumberObjectElement,
    StringObjectElement,
    ArrayObjectElement,
    FunctionObjectElement,
    ErrorObjectElement,
    RegExpObjectElement,
    DateObjectElement
};
export default Lab;
