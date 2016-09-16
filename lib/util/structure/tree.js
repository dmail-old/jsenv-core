/* eslint-disable no-use-before-define */

import util from './util.js';

const Tree = util.extend({
    scan(value) {
        const node = this.createNode(value);
        node.populate();
        return node;
    },

    createNode(value) {
        const NodePrototypeMatchingValue = this.match(value);
        const node = NodePrototypeMatchingValue.create(value);
        return node;
    },

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
    },

    populate() {
        // this function is called to stuff related to node.data
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
                    var index = children.indexOf(node);

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
    addChild(firstArg) {
        let node;
        if (Node.isPrototypeOf(firstArg)) {
            node = firstArg[Symbol.species].prototype.create(firstArg.data);
        } else {
            node = Tree.createNode(firstArg);
        }

        node.parent = this;
        if (this.hasOwnProperty('children') === false) {
            this.children = this.children.slice();
        }
        this.children.push(node);

        // search if child.data already exists, if so make child pointTo the existing node
        // when child is pointing on a node it doesn't have to be populated
        let nodeUsingSameData = node.findPreviousNodeByData(node.data);
        if (nodeUsingSameData) {
            node.pointTo(nodeUsingSameData);
        } else {
            node.populate();
        }

        return node;
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
    pointers: []
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
//     // }
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
            const propertyNames = this.listPropertyNames();

            // console.log('property names are', propertyNames);

            propertyNames.forEach(function(name) {
                // console.log('register property named', name);
                this.registerProperty(name);
            }, this);
        },

        listPropertyNames() {
            return Object.getOwnPropertyNames(this.data);
        },

        registerProperty(name) {
            const property = Property.create(name);
            // this.addChild(property);
            // this will create a copy and that's no what we want
            // I think our structure must reflect how value behaves in JavaScript
            // to avoid this kind of surprise
            // so a value may only have propertyNodeChild
            // and a propertyNodeChild may only have valueChild which may be related to .value or .set or .get
            this.children = [];
            this.children.push(property);
            property.parent = this;
            property.populate();
            return property;
        }
    };

    let LinkNode = Node.extend();

    let Property = LinkNode.extend({
        name: '',
        enumerable: true,
        configurable: true,
        writable: true,
        value: undefined,
        get: undefined,
        set: undefined,

        constructor(name) {
            // console.log('create property named', name);
            this.name = name;
        },

        populate() {
            const owner = this.parent.data;
            const name = this.name;
            // console.log('get property', name, 'on', owner, 'for property', this);
            const propertyDescriptor = Object.getOwnPropertyDescriptor(owner, name);

            if ('value' in propertyDescriptor) {
                this.writable = propertyDescriptor.writable;
                this.configurable = propertyDescriptor.configurable;
                this.enumerable = propertyDescriptor.enumerable;
                // console.log('add child from value', propertyDescriptor.value);
                this.value = this.addChild(propertyDescriptor.value);
            } else {
                this.configurable = propertyDescriptor.configurable;
                this.enumerable = propertyDescriptor.enumerable;
                const getter = propertyDescriptor.get;
                if (getter) {
                    this.get = this.addChild(propertyDescriptor.get);
                }
                const setter = propertyDescriptor.set;
                if (setter) {
                    this.set = this.addChild(propertyDescriptor.set);
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
            let barNodeChild = fooNode.addChild('bar');
            let fooNodeEquivalentChild = fooNode.addChild('foo');

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

        this.add('object', function() {
            let node = Tree.scan({
                foo: true
            });

            console.log(node);
        });
    }
};
