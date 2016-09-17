/* eslint-disable no-use-before-define */

import util from './util.js';

// Data, PrimitiveData -> pref this
// Variable, PrimitiveVariable

function insertBefore(array, before, entry) {
    const index = array.indexOf(before);
    if (index === -1) {
        array.push(entry);
    } else {
        array.splice(index, 0, entry);
    }
}

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
    DataPrototypes: []
});

const Data = util.extend({
    value: undefined,
    link: null,
    constructor(value) {
        if (arguments.length > 0) {
            this.value = value;
        }
    },

    extend(...args) {
        const DataPrototype = util.extend.apply(this, args);
        insertBefore(Tree.DataPrototypes, this, DataPrototype);
        return DataPrototype;
    }
});

const ObjectData = Data.extend({
    constructor() {
        this.links = [];
    },

    match(value) {
        return util.isPrimitive(value) === false;
    },

    populate(value) {
        this.value = value;
        this.populatePropertiesGuard();
        this.populateProperties();
    },

    populatePropertiesGuard() {
        const value = this.value;

        if (Object.isFrozen(value)) {
            this.markAsFrozen();
        } else if (Object.isSealed(value)) {
            this.markAsSealed();
        } else if (Object.isExtensible(value) === false) {
            this.markAsNonExtensible();
        }
    },

    markAsFrozen() {
        this.propertiesGuard = 'frozen';
    },

    markAsSealed() {
        this.propertiesGuard = 'sealed';
    },

    markAsNonExtensible() {
        this.propertiesGuard = 'non-extensible';
    },
    propertiesGuard: 'none',

    populateProperties() {
        const propertyNames = this.listPropertyNames();

        propertyNames.forEach(function(name) {
            this.addProperty(name, Object.getOwnPropertyDescriptor(this.value, name));
        }, this);
    },

    listPropertyNames() {
        return Object.getOwnPropertyNames(this.data);
    },

    addProperty(propertyName, attributes) {
        let property = new ObjectProperty(this, propertyName, attributes);
        this.links.push(property);
    }
});

// link between a data and one to many other : an object property for instance
const DataLink = util.extend({
    source: null, // sourceData
    target: null, // targetData (a link may reference many targetData for instance ObjectProperty set + get)

    constructor(source) {
        this.source = source;
    }
});

const ObjectProperty = DataLink.extend({
    type: 'property',
    name: '',
    attributes: {
        value: undefined,
        writable: true,
        configurable: true,
        enumerable: true
    },
    valueData: undefined,
    setData: undefined,
    getData: undefined,

    constructor(sourceData, name, attributes) {
        DataLink.constructor.call(this, sourceData);

        // console.log('create property named', name);
        this.name = name;
        this.attributes = attributes;

        if ('value' in attributes) {
            // console.log('add child from value', propertyDescriptor.value);
            this.valueData = this.createTargetData(attributes.value);
        } else {
            const getter = attributes.get;
            if (getter) {
                this.getData = this.createTargetData(attributes.get);
            }
            const setter = attributes.set;
            if (setter) {
                this.setData = this.createTargetData(attributes.set);
            }
        }
    },

    createTargetData(value) {
        const dataUsingSameValue = this.sourceData.findPreviousDataOrSelfUsingValue(value);

        let data;
        if (dataUsingSameValue) {
            data = dataUsingSameValue.createPointer();
        } else {
            data = Tree.createData(value);
        }

        return data;
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
            var links = deepestNode.links;

            if (links) {
                var linksLength = links.length;

                if (linksLength > 0) {
                    var lastLink = links[linksLength - 1];
                    deepestNode = lastLink;
                    continue;
                }
            }
            break;
        }

        return deepestNode;
    }

    // l'idée ici c'est de parcourir uniquement les noeud datas mais pas les liens
    // les liens servent uniquement à parcourir les data donc ils doivent être bien construit, ce n'est pas le cas actuellement

    return {
        createPreviousIterable() {
            var node = this;

            return createIterable(function() {
                var link = node.link;

                if (link) {
                    var links = link.links;
                    var index = links.indexOf(node);

                    if (index === -1) {
                        node = getDeepestNodeOrSelf(link);

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
                        node = link;
                    } else {
                        var previousSibling = links[index - 1];
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

ObjectData.define({
    findPreviousDataOrSelfUsingValue(value) {
        let dataUsingSameValue = null;
        if (this.value === value) {
            dataUsingSameValue = this;
        } else {
            for (let data of this.createPreviousIterable()) {
                if (data.value === value && !data.pointedData) {
                    dataUsingSameValue = data;
                    break;
                }
            }
        }
        return dataUsingSameValue;
    },

    createPointer() {
        const pointerData = new Data();
        pointerData.pointTo(this);
        return pointerData;
    },

    pointTo(data) {
        // here we should remove all stuff relative to populate()
        // like children and other properties created by it
        // an other way to do this would be to create a new node with only.data property
        // and to do this.replace(pointerNode)

        this.pointedData = data;
        data.addPointer(this);

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

// some methods to modify the current ObjectData (add/remove/define property, make it sealed/frozen/nonExtensible)
ObjectData.define({
    has(propertyName) {
        return this.links.some(function(link) {
            return link.type === 'property' && link.name === propertyName;
        });
    },

    get: function(propertyName) {
        const propertyLink = this.links.find(function(link) {
            return link.type === 'property' && link.name === propertyName;
        });
        let propertyValue;
        if (propertyLink) {
            propertyValue = propertyLink.value;
        } else {
            propertyValue = undefined;
        }
        return propertyValue;
    },

    set: function(propertyName, value) {
        return this.defineProperty(propertyName, {
            value: value
        });
    },

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/defineProperty
    defineProperty(propertyName, attributes) {
        Object.defineProperty(this.value, propertyName, attributes);
        // create a property and add it
        return this.addProperty(propertyName, attributes);
    },

    deleteProperty(propertyName) {
        delete this.value[propertyName];
        this.removeProperty(propertyName);
    },

    removeProperty(propertyName) {
        const propertyIndex = this.links.findIndex(function(link) {
            return link.type === 'property' && link.name === propertyName;
        });
        this.links.splice(propertyIndex, 1);
    },

    preventExtensions() {
        Object.preventExtensions(this.value);
        this.markAsNonExtensible();
    },

    seal() {
        Object.seal(this.value);
        this.markAsSealed();
    },

    freeze() {
        Object.freeze(this.value);
        this.markAsFrozen();
    }
});

// const ArrayData = ObjectData.extend();
// const FunctionData = ObjectData.extend();
// const SetData = ObjectData.extend();
// const SetEntry = DataLink.extend();
// const MapData = ObjectData.extend();
// const MapEntry = DataLink.extend();

// something that would be awesome : be able to add unit test right here
// instead of having to define all of them at the end of the file

// primitive data
Data.extend({
    referencable: false,

    match(value) {
        return util.isPrimitive(value);
    }
});

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
