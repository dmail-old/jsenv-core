/* eslint-disable no-use-before-define */

import util from './util.js';

// Data, PrimitiveData -> pref this
// Variable, PrimitiveVariable
// Twin
// Mirror
// Shadow -> j'aime beaucoup shadow, dans l'idée du shadow dom en plus
// Derived

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
    Prototype: Object.prototype,

    constructor() {
        Data.constructor.apply(this, arguments);
        this.links = [];
    },

    match(value) {
        return this.Prototype.isPrototypeOf(value);
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
        let property = ObjectProperty.create(this, propertyName, attributes);
        return property;
    }
});

// link between a data and one to many other : an object property for instance
const ObjectLink = util.extend({
    source: null, // sourceData
    targets: [],

    constructor(source) {
        this.source = source;
        this.targets = [];
    },

    addTarget(firstArg) {
        let targetData;
        if (Data.isPrototypeOf(firstArg)) {
            // we may have to trhow if firstArg has already a link property ?
            targetData = firstArg;
        } else {
            targetData = this.createTarget(firstArg);
        }

        targetData.link = this;
        this.targets.push(targetData);

        if (targetData.referencable) {
            const dataUsingSameValue = this.findPreviousDataOrSelfUsingValue(targetData.value);
            if (dataUsingSameValue) {
                targetData.pointTo(dataUsingSameValue);
            }
        }

        return targetData;
    },

    createTarget(value) {
        let data = Tree.createData(value);
        return data;
    },

    findPreviousDataOrSelfUsingValue(value) {
        let dataUsingSameValue = null;
        // if (this.value === value) {
        //     dataUsingSameValue = this;
        // } else {
        for (let data of this.createPreviousIterable()) {
            if (data.value === value && !data.pointedData) {
                dataUsingSameValue = data;
                break;
            }
        }
        // }
        return dataUsingSameValue;
    }
});

// pas sûr que ce soit sur objectData qu'il faille mettre ça, c'est plutot sur link
// ou alors faut le mettre sur Data
ObjectLink.define((function createNodeIterationMethods() {
    var properties = {
        createPreviousIterable() {
            var data = this.targets[this.targets.length - 1];

            return createIterable(function() {
                var link = data.link;

                if (link) {
                    const targets = link.targets;
                    const index = targets.indexOf(data);

                    if (index === -1) {
                        throw new Error(data + 'not targeted by link');
                    }
                    // there is no previousTarget, so get the previous from parent ignoring this branch
                    if (index === 0) {
                        data = getDeepestDataBeforeLink(link);
                    } else {
                        var previousTarget = targets[index - 1];
                        data = getDeepestDataOrSelf(previousTarget);
                    }
                } else {
                    data = undefined;
                }

                var result = {
                    done: !data,
                    value: data
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

    function createIterable(nextMethod) {
        return {
            [Symbol.iterator]: function() {
                return this;
            },
            next: nextMethod
        };
    }

    function getDeepestDataBeforeLink(link) {
        let linkSource = link.source;
        let sourceLinks = linkSource.links;
        let linkIndex = sourceLinks.indexOf(link);
        let deepestData;

        if (linkIndex === 0) {
            deepestData = linkSource;
        } else {
            const previousLink = sourceLinks[linkIndex - 1];
            deepestData = getLinkDeepestData(previousLink);
        }

        // console.log('the deepestData before', link.name, 'is', deepestData.value, 'by the link', deepestData.link.name);

        return deepestData;
    }

    function getLinkDeepestData(link) {
        const targets = link.targets;
        const deepestData = targets[targets.length - 1];
        return deepestData;
    }

    function getDeepestDataOrSelf(data) {
        let deepestData = data;

        while (true) { // eslint-disable-line
            const links = deepestData.links;
            const linksLength = links.length;

            if (linksLength > 0) {
                const lastLink = links[linksLength - 1];
                deepestData = getLinkDeepestData(lastLink);
                continue;
            }
            break;
        }

        return deepestData;
    }

    return properties;
})());

ObjectData.define({
    referencable: true,

    createPointer() {
        const pointerData = new Data(this.value);
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

const ObjectProperty = ObjectLink.extend({
    type: 'property',
    name: '',
    attributes: {
        value: undefined,
        writable: true,
        configurable: true,
        enumerable: true
    },
    value: undefined,
    set: undefined,
    get: undefined,

    constructor(sourceData, name, attributes) {
        ObjectLink.constructor.call(this, sourceData);

        // console.log('create property named', name);
        this.name = name;
        this.attributes = attributes;
        sourceData.links.push(this);
        this.populate();
    },

    populate() {
        const attributes = this.attributes;

        if ('value' in attributes) {
            // console.log('add child from value', propertyDescriptor.value);
            this.value = this.addTarget(attributes.value);
        } else {
            const getter = attributes.get;
            if (getter) {
                this.get = this.addTarget(attributes.get);
            }
            const setter = attributes.set;
            if (setter) {
                this.set = this.addTarget(attributes.set);
            }
        }
    }
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
// const ArrayEntry = ObjectProperty.extend();
// const FunctionData = ObjectData.extend();
// const SetData = ObjectData.extend();
// const SetEntry = ObjectLink.extend();
// const MapData = ObjectData.extend();
// const MapEntry = ObjectLink.extend();

// something that would be awesome : be able to add unit test right here
// instead of having to define all of them at the end of the file

const Primitive = Data.extend({
    referencable: false
});
// boolean primitive
Primitive.extend({
    match(value) {
        return typeof value === 'boolean';
    }
});

export default Tree;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('manual object shadow', function() {
            let value = {};
            let object = ObjectData.create(value);
            let fooProperty = object.set('foo', true);
            let barProperty = object.set('bar', true);

            assert(object.links.length === 2);
            assert(object.links[0] === fooProperty);
            assert(object.links[1] === barProperty);

            let previousDatas = Array.from(barProperty.createPreviousIterable());
            assert(previousDatas.length === 2);
            assert(previousDatas[0].value === true);
            assert(previousDatas[1].value === value);
        });

        this.add('object shadow with pointers', function() {
            // assert(fooProperty.valueData.pointers.length === 1);
            // assert(fooProperty.valueData.pointers[0] === barProperty.valueData);
            // assert(barProperty.valueData.pointedData === fooProperty.valueData);
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
