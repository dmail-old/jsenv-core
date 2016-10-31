/* eslint-disable no-use-before-define */

// https://github.com/Yomguithereal/baobab

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

        clone.data = this.data;
        this.children.forEach(function(child) {
            clone.appendChild(child.clone());
        }, this);

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
    merge(element) {
        // merging two values, what do we do?
        // this is obviously a value without a merge strategy so it is overided by the element
        // merging strat
        // but it means something completely crazy : the element must become something it isn't
        // let's say we are a Boolean we must become an Object using the merge approach it's not possible
        // because we modify the current object in place
        // but what we want is to replace it
        // maybe this is what we want -> this.replace(element.clone());
        this.replace(element.clone());
    },

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
        return ElementProperty.create(name);
    },

    addProperty(property) {
        const currentProperty = this.getProperty(property.name);
        if (currentProperty) {
            currentProperty.merge(property);
            // this.replaceChild(currentProperty, currentProperty.merge(property));
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

    merge(objectElement) {
        for (let property of objectElement) {
            this.addProperty(property);
        }
        return this;
    },

    compile() {
        const target = {};
        for (let property of this) {
            target[property.name] = property.compile();
        }
        return target;
    }
});

const ElementProperty = Node.extend({
    constructor(name) {
        this.name = name;
        Node.constructor.call(this);
    },

    merge(property) {
        // even if this.children[0] is an object
        // merge should not modify it ?
        // so by default this line should always try to clone the child to prevent mutation ?
        return this.children[0].merge(property.children[0]);
    },

    write(value) {
        // selon la valeur faut créer le bon valueNode, ce n'est pas cas d'où la boucle infiniesurement
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

const dam = {name: 'dam'};
const seb = {name: 'seb', age: 10};
const damElement = parse(dam).write(dam);
const sebElement = parse(seb).write(seb);
const merged = damElement.merge(sebElement);
console.log(merged.compile());

export default parse;
