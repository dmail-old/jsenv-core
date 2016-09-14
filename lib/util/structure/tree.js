/* eslint-disable no-use-before-define */

import util from './util.js';

const Tree = util.extend({
    match(value) {
        if (arguments.length === 0) {
            throw new Error('DefinitionDatabase match expect one arguments');
        }
        let NodePrototypeMatchingValue = this.NodePrototypes.find(function(NodePrototype) {
            return NodePrototype.match(value);
        });
        if (!NodePrototypeMatchingValue) {
            throw new Error('no registered node prototype matches value ' + value);
        }
        return NodePrototypeMatchingValue;
    },
    NodePrototypes: [],

    register(...args) {
        const NodePrototype = Node.extend(...args);
        this.NodePrototypes.push(NodePrototype);
        return NodePrototype;
    },

    scan(value) {
        const NodePrototypeMatchingValue = this.match(value);
        const node = NodePrototypeMatchingValue.create(value);
        node.populate();
        return node;
    }
});

const Node = util.extend({
    data: undefined,
    parent: null,
    children: [],
    constructor(data) {
        if (arguments.length > 0) {
            this.data = data;
        }
    }
});

Node.define((function createNodeIterationMethods() {
    function createIterable(nextMethod) {
        return {
            [Symbol.iterator]: function() {
                return this;
            },
            next: nextMethod
        };
    }

    function getDeepestNodeOrSelf(node) {
        var deepestNode = node;

        while (true) { // eslint-disable-line
            var children = deepestNode.children;

            if (children) {
                var childrenLength = children.length;

                if (childrenLength > 0) {
                    var lastChild = children[childrenLength - 1];
                    deepestNode = lastChild;
                    continue;
                }
            }
            break;
        }

        return deepestNode;
    }

    return {
        createPreviousIterable() {
            var node = this;

            return createIterable(function() {
                var parent = node.parent;

                if (parent) {
                    var children = parent.children;
                    var index = children.findIndex(function(child) {
                        return child === node;
                    });

                    if (index === -1) {
                        node = getDeepestNodeOrSelf(parent);

                        // console.error('the following node is not in its parent children', node, 'the parent', parent);
                        // throw new Error('unable to find node in parent children');
                        // node is not yet in it's parent propertyDefinitions so we consider the last child as previousSibling
                        // we hardoc this for now but it shoud throw because considering the last child as previousSibling
                        // is only true if we plan to push the node in children array
                        // index = children.length - 1;
                        // if (index === -1) {
                        //     index = 0;
                        // }
                    } else if (index === 0) { // there is no previousSibling
                        node = parent;
                    } else {
                        var previousSibling = children[index - 1];
                        node = getDeepestNodeOrSelf(previousSibling);
                    }
                } else {
                    node = undefined;
                }

                var result = {
                    done: !node,
                    value: node
                };

                return result;
            });
        },

        createNextIterable() {

        },

        createDescendantIterable() {

        },

        createAncestorIterable() {

        }
    };
})());

Node.define({
    addChild(node) {
        const ownNode = node[Symbol.species].prototype.create(node.data);
        ownNode.parent = this;

        if (this.hasOwnProperty('children') === false) {
            this.children = this.children.slice();
        }
        this.children.push(ownNode);

        // search if child.data already exists, if so make child pointTo the existing node
        // when child is pointing on a node it doesn't have to be populated
        let nodeUsingSameData = ownNode.findPreviousNodeByData(node.data);
        if (nodeUsingSameData) {
            ownNode.pointTo(nodeUsingSameData);
        } else {
            ownNode.populate();
        }

        return ownNode;
    },

    findPreviousNodeByData(data) {
        let nodeUsingSameData = null;
        for (let node of this.createPreviousIterable()) {
            if (node.data === data && node.hasOwnProperty('pointedNode') === false) {
                nodeUsingSameData = node;
                break;
            }
        }
        return nodeUsingSameData;
    },

    pointTo(previousNode) {
        // here we should remove all stuff relative to populate()
        // like children and other properties created by it
        // an other way to do this would be to create a new node with only.data property
        // and to do this.replace(pointerNode)

        this.pointedNode = previousNode;
        previousNode.addPointer(this);

        return this;
    },

    addPointer(pointer) {
        if (this.hasOwnProperty('pointers') === false) {
            this.pointers = [];
        }
        this.pointers.push(pointer);
    },
    pointers: [],

    populate() {
        // this function is called to stuff related to node.data
    }
});

// something that would be awesome : be able to add unit test right here
// instead of having to define all of them at the end of the file

// Node.define({
//     // contains() {
//     //     return false;
//     // },

//     // hasChildren() {
//     //     return this.children.length > 0;
//     // },

//     // isLeaf() {
//     //     return this.children.length === 0;
//     // },

//     addChildFromData(data) {
//         let node;
//         const previousNodeWithSameData = this.findPreviousNodeByData(data);

//         if (previousNodeWithSameData) {
//             node = this.addChildPointingTo(previousNodeWithSameData);
//         } else {
//             const NodePrototypeMatchingData = Tree.match(data);
//             node = NodePrototypeMatchingData.create(data);
//             this.addChild(node);
//             node.populate();
//         }

//         return node;
//     },

//     addChildPointingTo(pointedNode) {
//         const childNode = pointedNode.createPointer();
//         this.addChild(childNode);
//         return childNode;
//     }
// });

// je vois pas comment on pourra gérer pointerNode comme ça
// je pense qu'en fait la seule chose qui se passera c'est que lorsqu'on fait addChild d'un noeud
// on check toujours si le node.value existe déjà, si oui alors le noeud devient une référence
// ou alors on a un arbre qui connait toutes les références
// const PointerNode = Node.extend({
//     constructor(pointedNode) {
//         Node.call(this, pointedNode.data);
//         this.pointer = Pointer.create(pointedNode);
//         pointedNode.addPointer(this.pointer);
//     }
// });
// const Pointer = util.extend({
//     constructor(node) {
//         this.node = node;
//     },

//     move() {
//         // because the node is being moved into an other parent there is huge probability that the pointer is lost
//         // because a pointerNode is always after the pointedNode, can we assume that moving the pointerNode
//         // means the pointerNode lost access to the the pointedNode ?
//         // -> I think yep
//         // so when being moved a pointerNode is lossing access to it's pointedNode
//         // in such case the node should be transformed into something new
//         // maybe an other pointerNode pointing a new node in the tree
//         // maybe an other node
//         // moreover adding a node in the tree may cause next node to become reference to this one
//     }
// });
//     removeChild(node) {
//         let index = this.children.indexOf(node);
//         if (index > -1) {
//             this.children.splice(index, 1);
//             node.parent = null;
//         }
//     },

Tree.register({
    name: 'primitive',

    match(value) {
        return util.isPrimitive(value);
    },

    populate() {

    }
});

Tree.register((function createObjectNodeProperties() {
    const properties = {
        name: 'object',

        match(value) {
            return util.isPrimitive(value) === false;
        },

        populate() {
            this.populatePropertiesGuard();
            this.populateProperties();
        },

        populatePropertiesGuard() {
            const value = this.data;

            if (Object.isFrozen(value)) {
                this.propertiesGuard = 'frozen';
            } else if (Object.isSealed(value)) {
                this.propertiesGuard = 'sealed';
            } else if (Object.isExtensible(value) === false) {
                this.propertiesGuard = 'non-extensible';
            }
        },
        propertiesGuard: 'none',

        populateProperties() {
            this.listPropertyNames().forEach(function(name) {
                this.registerProperty(name);
            }, this);
        },

        listPropertyNames() {
            return Object.getOwnPropertyNames(this.data);
        },

        registerProperty(name) {
            const property = Property.create();

            this.addChild(property); // add property immediatly so that it can reach this & ancestor
            property.setAttribute('name', name);
            // property.populate();

            return property;
        }
    };

    let LinkNode = Node.extend({
        createAttribute(name, value) {
            return Attribute.create(name, value);
        },

        hasAttribute(name) {
            return name in this;
        },

        getAttribute(name) {
            return this[name];
        },

        setAttribute(name, value) {
            let attribute;
            if (this.hasAttribute(name)) {
                attribute = this.getAttribute(name);
            }

            if (attribute && attribute.value === value) {
                // noop
            } else {
                attribute = this.createAttribute(name, value);
                this[name] = attribute;
                const childNode = this.addChildFromData(attribute.value);
                attribute.node = childNode;
            }

            return attribute;
        },

        removeAttribute(name) {
            if (this.hasAttribute(name)) {
                this.removeChild(this.getAttribute(name).node);
            }
        }
    });

    let Attribute = util.extend({
        name: 'anonymous',

        constructor(name, value) {
            this.name = name;
            this.value = value;
        }
    });

    let Property = LinkNode.extend({
        attributes: {
            name: '',
            value: undefined,
            enumerable: true,
            configurable: true,
            writable: true
        },

        populate() {
            const owner = this.parent.data;
            const name = this.getAttribute('name');
            const propertyDescriptor = Object.getOwnPropertyDescriptor(owner, name);

            if ('value' in propertyDescriptor) {
                this.setAttribute('writable', propertyDescriptor.writable);
                this.setAttribute('configurable', propertyDescriptor.configurable);
                this.setAttribute('enumerable', propertyDescriptor.enumerable);
                this.setAttribute('value', propertyDescriptor.value);
            } else {
                this.setAttribute('configurable', propertyDescriptor.configurable);
                this.setAttribute('enumerable', propertyDescriptor.enumerable);

                const setter = propertyDescriptor.set;
                if (setter) {
                    this.setAttribute('set', propertyDescriptor.set);
                }
                const getter = propertyDescriptor.get;
                if (getter) {
                    this.setAttribute('get', propertyDescriptor.get);
                }
            }
        }
    });
    // this is for perf, so for now just ignore later we'll reenable this
    // Object.keys(Property.attributes).forEach(function(attrName) {
    //     Property.setAttribute(attrName, Property.attributes[attrName]);
    // });

    // let PropertyAccessorLinkNode = util.extendConstructor(LinkNode);
    // attributes = {
    //     name: '',
    //     get: undefined,
    //     set: undefined,
    //     enumerable: true,
    //     configurable: true
    // };
    // Object.keys(attributes).forEach(function(attrName) {
    //     PropertyAccessorLinkNode.prototype.setAttribute(attrName, attributes[attrName]);
    // });

    // let SetEntryLinkNode = util.extendConstructor(LinkNode);
    // SetEntryLinkNode.prototype.setAttribute('value', undefined);

    // let MapEntryLinkNode = util.extendConstructor(LinkNode);
    // MapEntryLinkNode.prototype.setAttribute('name', '');
    // MapEntryLinkNode.prototype.setAttribute('value', undefined);

    return properties;
})());

export default Tree;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('manual node.addChild', function() {
            let fooNode = Node.create('foo');
            let barNode = Node.create('bar');
            let fooNodeEquivalent = Node.create('foo');
            let barNodeChild = fooNode.addChild(barNode);
            let fooNodeEquivalentChild = fooNode.addChild(fooNodeEquivalent);

            assert(fooNode.children.length === 2);
            assert(fooNode.children[0] === barNodeChild);
            assert(fooNode.children[1] === fooNodeEquivalentChild);
            assert(fooNode.pointers.length === 1);
            assert(fooNode.pointers[0] === fooNodeEquivalentChild);
            assert(fooNodeEquivalentChild.pointedNode === fooNode);
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
