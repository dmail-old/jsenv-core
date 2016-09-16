/* eslint-disable no-use-before-define */

import util from './util.js';

// Data, PrimitiveData -> pref this
// Variable, PrimitiveVariable

const Tree = util.extend({
    scan(value) {
        const data = this.createData(value);
        data.populate();
        return data;
    },

    createData(value) {
        const DataPrototypeMatchingValue = this.match(value);
        const data = DataPrototypeMatchingValue.create(value);
        return data;
    },

    match(value) {
        if (arguments.length === 0) {
            throw new Error('DefinitionDatabase match expect one arguments');
        }
        let DataPrototypeMatchingValue = this.DataPrototypes.find(function(DataPrototype) {
            return DataPrototype.match(value);
        });
        if (!DataPrototypeMatchingValue) {
            throw new Error('no registered node prototype matches value ' + value);
        }
        return DataPrototypeMatchingValue;
    },
    DataPrototypes: [],

    register(...args) {
        const DataPrototype = Data.extend(...args);
        this.DataPrototypes.push(DataPrototype);
        return DataPrototype;
    }
});

const Data = util.extend({
    value: undefined,
    parent: null,
    constructor(value) {
        if (arguments.length > 0) {
            this.value = value;
        }
    },

    register(args) {
        const DataType = this.extend(...args);
        Tree.DataPrototypes.push(DataType);
        return DataType;
    }
});

const PrimitiveData = Data.register({
    match(value) {
        return util.isPrimitive(value);
    }
});
Tree.DataPrototypes.push(PrimitiveData);

const ObjectData = Data.register({
    constructor() {
        this.properties = [];
    },

    match(value) {
        return util.isPrimitive(value) === false;
    },

    addProperty(firstArg) {
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
        let nodeUsingSameData = node.findPreviousValue(node.data);
        if (nodeUsingSameData) {
            node.pointTo(nodeUsingSameData);
        } else {
            node.populate();
        }

        return node;
    },

    findPreviousValue(data) {
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

    removeProperty(node) {
        let index = this.children.indexOf(node);
        if (index > -1) {
            this.children.splice(index, 1);
            node.parent = null;
        }
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
        const property = ObjectProperty.create(name);
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
});
ObjectData.define((function createNodeIterationMethods() {
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
Tree.DataPrototypes.push(ObjectData);

const ObjectProperty = util.extend({
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

    createData() {

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
            this.value = Tree.createData(propertyDescriptor.value);
        } else {
            this.configurable = propertyDescriptor.configurable;
            this.enumerable = propertyDescriptor.enumerable;
            const getter = propertyDescriptor.get;
            if (getter) {
                this.get = Tree.createData(propertyDescriptor.get);
            }
            const setter = propertyDescriptor.set;
            if (setter) {
                this.set = Tree.createData(propertyDescriptor.set);
            }
        }
    }
});
// const ObjectPropertyAccessor;

// const ArrayData;
// const FunctionData;
// const SetData;
// const SetEntry;
// const MapData;
// const MapEntry;

// something that would be awesome : be able to add unit test right here
// instead of having to define all of them at the end of the file

export default Tree;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('manual node.addChild', function() {
            let data = Data.create({});
            let fooProperty = data.setProperty('foo', true);
            let barProperty = data.setProperty('bar', true);

            assert(data.properties.length === 2);
            assert(data.properties[0] === fooProperty);
            assert(data.properties[1] === barProperty);
            assert(fooProperty.valueData.pointers.length === 1);
            assert(fooProperty.valueData.pointers[0] === barProperty.valueData);
            assert(barProperty.valueData.pointedData === fooProperty.valueData);
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
