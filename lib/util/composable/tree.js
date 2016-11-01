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

export const text = {
    main() {

    }
};

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

    compose(node) {
        const clone = this.clone();
        clone.merge(node);
        return clone;
    },

    [Symbol.iterator]() {
        return this.children[Symbol.iterator]();
    }
});

function isPrimitive(value) {
    if (value === null) {
        return true;
    }
    if (typeof value === 'object' || typeof value === 'function') {
        return false;
    }
    return true;
}

const PrimitiveElement = Node.extend({
    compile() {
        return this.data;
    },

    write(data) {
        this.data = data;
    }
});

const ObjectElement = Node.extend({
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
const ObjectPropertyElement = Node.extend({
    constructor(name) {
        this.name = name;
        Node.constructor.call(this);
    },

    write(value) {
        const valueNode = parse(value);
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

function parse(value) {
    let element;

    if (isPrimitive(value)) {
        element = PrimitiveElement.create();
    } else {
        element = ObjectElement.create();
    }

    return element;
}

const dam = {name: 'dam', item: {name: 'sword'}};
const seb = {name: 'seb', item: {price: 10}, age: 10};
const damElement = parse(dam).write(dam);
const sebElement = parse(seb).write(seb);
// const merged = damElement.merge(sebElement);
const composed = damElement.compose(sebElement);
console.log(damElement.compile(), composed.compile());

export default parse;
