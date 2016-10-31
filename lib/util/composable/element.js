/* eslint-disable no-use-before-define */

/*
ok en fait c'est még compliqué, il faut un vrai truc bien touffu genre baobab : https://github.com/Yomguithereal/baobab
qui va vraiment être capable de merge/clone/undo/redo une structure en arbre
*/

import util from './util.js';
import TreeNavigator from './tree-navigator.component.js';

const Node = util.extend({
    constructor() {
        this.children = [];
    },

    [Symbol.iterator]() {
        return this.children[Symbol.iterator]();
    },

    registerChild(name) {
        const node = this.createNode(name);
        this.appendChild(node);
        return node;
    },

    createNode() {
        // must be implemented (or by default could return a Node instance)
    },

    appendChild(node) {
        this.children.push(node);
        node.parent = this;
        return node;
    }
});
Node.use(TreeNavigator);

const Element = util.extend();
Element.use(Node);
Element.refine({
    diff(element) {
        if (Object.getPrototypeOf(this) !== Object.getPrototypeOf(element)) {
            throw new TypeError('cannot get diff between element with != prototype');
        }

        // return a list of operation to perform to obtain element from this
        // certainly a list of removeChild/addChild or updateChildAtPath stuff for now it's complicated to get the right vision
        const selfChildren = this.children;
        const elementChildren = element.children;
        const diffElement = this.createConstructor();
        const diffChildren = [];

        diffElement.children = diffChildren;
        selfChildren.forEach(function(child, index) {
            let elementChild;
            if (index < elementChildren) {
                elementChild = elementChildren[index];
                const diffChild = child.diff(elementChild);
                diffChildren.push(diffChild);
            } else {

            }
        }, this);

        return diffElement;
    }
});

// Element.from(arg) {
//         let properties;
//         if (this.isPrototypeOf(arg)) {
//             properties = arg;
//         } else {
//             properties = this.create();
//             properties.populate(arg);
//         }
//         return properties;
//     },

const Properties = util.extend({
    constructor() {

    },

    diff(arg) {
        const properties = Object.getPrototypeOf(this).from(arg);
        const diffProperties = this.createConstructor();

        for (let property of this) {
            let otherProperty = properties.get(property.name);
            if (otherProperty) {
                diffProperties.add(otherProperty);
            } else {
                diffProperties.add(property.delete());
            }
        }

        return diffProperties;
    },

    concat(properties) {
        const concatenedProperties = this.clone();
        concatenedProperties.merge(properties);
        return concatenedProperties;
    },

    clone() {
        const clone = this.createConstructor();
        // don't have to clone property
        // because every action on property does not mutate the property it creates a new one
        // that's one of the strength of being immutable
        // Object.assign(clone.map, this.map);
        return clone;
    },

    merge(properties) {
        for (let property of properties) {
            this.importProperty(property);
        }
        return this;
    },

    importProperty(property) {
        const currentProperty = this.get(property.name);
        if (currentProperty) {
            // here we can hook for conflict resolution
            this.replaceChild(currentProperty, property);
        } else {
            this.appendChild(property);
        }
    },

    has(name) {
        return this.children.some(function(child) {
            return child.name === name;
        });
    },

    get(name) {
        return this.children.find(function(child) {
            return child.name === name;
        });
    },

    define(target) {
        for (let property of this) {
            property.define(target);
        }
    }
});
Properties.use(Node);
Properties.refine({
    createNode(name) {
        return Property.create(name);
    },

    fill(data, deep = false) {
        if (Object.prototype.isPrototypeOf(data)) {
            const object = data;

            Object.keys(object).forEach(function(name) {
                const property = this.registerChild(name);
                property.fill(object);
            }, this);

            if (deep) {
                let objectAncestor = Object.getPrototypeOf(object);
                while (objectAncestor) {
                    Object.keys(objectAncestor).forEach(function(name) { // eslint-disable-line
                        if (this.has(name) === false) {
                            const property = this.registerChild(name);
                            property.fill(objectAncestor);
                        }
                    }, this);
                    objectAncestor = Object.getPrototypeOf(objectAncestor);
                }
            }
        } else {
            // not an object we must be sure that this.map is empty
        }

        return this;
    }
});

const Property = util.extend({
    constructor(name) {
        this.name = name;
    },

    // it's usefull for resolve() because
    // each Properties must be immutable however cloning a property
    // is not that simple it involves cloning all the descendants as well (see cloneNode in the dom)
    clone() {
        const clone = this.createConstructor(this.name);
        clone.descriptor = this.descriptor;
        clone.resolver = this.resolver;
        return clone;
    },

    merge(otherProperty) {
        const selfDescriptor = this.descriptor;
        const otherDescriptor = otherProperty.descriptor;

        let situation = selfDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        situation += '-';
        situation += otherDescriptor.descriptor.hasOwnProperty('value') ? 'value' : 'accessor';

        if (situation === 'value-value') {
            selfDescriptor.writable = otherDescriptor.writable;
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // merge values
            this.valueNode.merge(otherProperty.valueNode);
        } else if (situation === 'accessor-value') {
            selfDescriptor.writable = otherDescriptor.writable;
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // remove accessors
            const getterNode = this.getterNode;
            if (getterNode) {
                getterNode.remove();
                delete this.getterNode;
                delete selfDescriptor.get;
            }
            const setterNode = this.setterNode;
            if (setterNode) {
                setterNode.remove();
                delete this.setterNode;
                delete selfDescriptor.set;
            }
            // use value
            this.valueNode = this.createNode();
            this.valueNode.import(otherProperty.valueNode);
            selfDescriptor.value = this.valueNode.value;
        } else if (situation === 'value-accessor') {
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // remove value
            this.valueNode.remove();
            delete this.valueNode;
            delete selfDescriptor.value;
            // use accessor
            const getterNode = otherProperty.getterNode;
            if (getterNode) {
                this.getterNode = this.createNode();
                this.getterNode.import(getterNode);
                selfDescriptor.get = getterNode.value;
            }
            const setterNode = otherProperty.setterNode;
            if (setterNode) {
                this.setterNode = this.createNode();
                this.setterNode.import(setterNode);
                selfDescriptor.set = setterNode.value;
            }
        } else if (situation === 'accessor-accessor') {
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // merge accessors
            const getterNode = otherProperty.getterNode;
            if (getterNode) {
                let selfGetterNode = this.getterNode;
                if (selfGetterNode) {
                    selfGetterNode.merge(getterNode);
                } else {
                    selfGetterNode = this.createNode();
                    this.getterNode = selfGetterNode;
                    selfGetterNode.import(getterNode);
                }
                selfDescriptor.get = selfGetterNode.value;
            }
            const setterNode = otherProperty.setterNode;
            if (setterNode) {
                let selfSetterNode = this.setterNode;
                if (selfSetterNode) {
                    selfSetterNode.merge(getterNode);
                } else {
                    selfSetterNode = this.createNode();
                    this.setterNode = selfSetterNode;
                    selfSetterNode.import(getterNode);
                }
                selfDescriptor.get = selfSetterNode.value;
            }
        }

        return this;
    },

    describe(descriptor) {
        if (typeof descriptor !== 'object' && descriptor !== null) {
            throw new TypeError('property.describe() first arguments must be an object or null');
        }

        // const currentDescriptor = this.descriptor;
        // if (this.isValue()) {
        //     this.valueNode.update(descriptor.value);
        // }

        const property = this.clone();
        property.descriptor = descriptor;
        return property;
    },

    delete() {
        return this.describe(null);
    },

    rename(name) {
        const renamedProperty = this.clone();
        renamedProperty.name = name;
        return renamedProperty;
    },

    set(value) {
        return this.describe(Object.assign({}, this.descriptor || {}, {value: value}));
    },

    install() {
        const descriptor = this.descriptor;

        if (descriptor) {
            // console.log('define property', this.name, 'on', this.owner);
            Object.defineProperty(this.owner, this.name, descriptor);
        } else {
            delete this.owner[this.name];
        }

        return this;
    },

    assign(owner) {
        let assignedProperty = this.clone();
        assignedProperty.owner = owner;
        return assignedProperty;
    },

    define(owner) {
        return this.assign(owner).install();
    }
});
Property.use(Node);
Property.refine({
    fill(data) {
        if (Object.prototype.isPrototypeOf(data) === false) { // object & function allowed
            throw new TypeError('property.from() first argument must inherit from Object.prototype');
        }

        // the thing is that Property may have several node in itself
        // in it's descriptor
        // and even its name could be a node
        // it makes me believe that property descriptor (name, value, get, set) are the property children
        // and thoose are something we don't have yet : the role used by unit for now
        // a value wrapper -> Element

        this.describe(Object.getOwnPropertyDescriptor(data, this.name));

        return this;
    }
});

export default Element;
