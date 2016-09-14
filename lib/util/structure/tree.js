import util from './util.js';

let treeIterationMethods = (function() {
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

        },

        createNextIterable() {
            var node = this;

            return createIterable(function() {
                var parent = node.parent;

                // we can do this early but that's not mandatory
                // we must check for value existence from this.previousSibling when existing
                // else from parent deepest propertyDefinition
                // else from parent

                if (parent) {
                    var children = parent.children;
                    var index = children.findIndex(function(child) {
                        return child.valueDefinition === node;
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

        createDescendantIterable() {

        },

        createAncestorIterable() {

        }
    };
})();

let Node = util.createConstructor({
    data: undefined,
    constructor(data) {
        if (data) {
            this.data = data;
        }
    },

    contains() {
        return false;
    },

    move(parent) {
        if (this.parent) {
            this.parent.removeChild(this);
        }
        this.parent = parent;
    },

    hasChildren() {
        return this.children.length > 0;
    },

    isLeaf() {
        return this.children.length === 0;
    },

    addChild(node) {
        node.move(this);
        if (this.hasOwnProperty('children') === false) {
            this.children = this.children.slice();
        }
        this.children.push(node);
    },

    removeChild(node) {
        let index = this.children.indexOf(node);
        if (index > -1) {
            this.children.splice(index, 1);
            node.parent = null;
        }
    },

    parent: null,
    children: []
}, treeIterationMethods);

let Pointer = util.createConstructor({
    constructor(node) {
        this.node = node;
    },

    move() {
        // because the node is being moved into an other parent there is huge probability that the pointer is lost
        // because a pointerNode is always after the pointedNode, can we assume that moving the pointerNode
        // means the pointerNode lost access to the the pointedNode ?
        // -> I think yep
        // so when being moved a pointerNode is lossing access to it's pointedNode
        // in such case the node should be transformed into something new
        // maybe an other pointerNode pointing a new node in the tree
        // maybe an other node
        // moreover adding a node in the tree may cause next node to become reference to this one
    }
});

// je vois pas comment on pourra gérer pointerNode comme ça
// je pense qu'en fait la seule chose qui se passera c'est que lorsqu'on fait addChild d'un noeud
// on check toujours si le node.value existe déjà, si oui alors le noeud devient une référence
// ou alors on a un arbre qui connait toutes les références
let PointerNode = util.extendConstructor(Node, {
    constructor(pointedNode) {
        Node.call(this, pointedNode.data);
        this.pointer = new Pointer(pointedNode);
        pointedNode.addPointer(this.pointer);
    }
});
Node.prototype.createPointer = function() {
    return new PointerNode(this);
};
Node.prototype.pointers = [];
Node.prototype.addPointer = function(pointer) {
    if (this.hasOwnProperty('pointers') === false) {
        this.pointers = [];
    }
    this.pointers.push(pointer);
};

let ValueNode = util.extendConstructor(Node, {

});

let AttributeNode = util.extendConstructor(Node, {
    name: 'anonymous',

    constructor(name, data) {
        this.name = name;
        Node.call(this, data);
    }
});

let LinkNode = util.extendConstructor(Node, {
    createAttributeNode(name, data) {
        return new AttributeNode(name, data);
    },

    hasAttribute(name) {
        return name in this;
    },

    getAttributeNode(name) {
        return this[name];
    },

    setAttribute(name, data) {
        let attributeNode;
        if (this.hasAttribute(name)) {
            attributeNode = this.getAttributeNode(name);
        }

        if (attributeNode && attributeNode.data === data) {
            // noop
        } else {
            attributeNode = this.createAttributeNode(name, data);
            this[name] = attributeNode;
            this.addChild(attributeNode);
        }

        return attributeNode;
    },

    removeAttribute(name) {
        if (this.hasAttribute(name)) {
            this.removeChild(this.getAttributeNode(name));
        }
    }
});

let PropertyLinkNode = util.extendConstructor(LinkNode);
let attributes = {
    name: '',
    value: undefined,
    enumerable: true,
    configurable: true,
    writable: true
};
Object.keys(attributes).forEach(function(attrName) {
    PropertyLinkNode.prototype.setAttribute(attrName, attributes[attrName]);
});

let PropertyAccessorLinkNode = util.extendConstructor(LinkNode);
attributes = {
    name: '',
    get: undefined,
    set: undefined,
    enumerable: true,
    configurable: true
};
Object.keys(attributes).forEach(function(attrName) {
    PropertyAccessorLinkNode.prototype.setAttribute(attrName, attributes[attrName]);
});

let SetEntryLinkNode = util.extendConstructor(LinkNode);
SetEntryLinkNode.prototype.setAttribute('value', undefined);

let MapEntryLinkNode = util.extendConstructor(LinkNode);
MapEntryLinkNode.prototype.setAttribute('name', '');
MapEntryLinkNode.prototype.setAttribute('value', undefined);

let Tree = {
    ValueNode: ValueNode,
    LinkNode: LinkNode,
    PropertyLinkNode: PropertyLinkNode,
    PropertyAccessorLinkNode: PropertyAccessorLinkNode,
    SetEntryLinkNode: SetEntryLinkNode,
    MapEntryLinkNode: MapEntryLinkNode
};

export default Tree;
