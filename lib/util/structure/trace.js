/* eslint-disable no-use-before-define */

import util from './util.js';

// Data, PrimitiveData -> pref this
// Variable, PrimitiveVariable
// Twin
// Mirror
// Shadow -> j'aime beaucoup shadow, dans l'idée du shadow dom en plus
// Derived
// Trace -> le meilleur je pense parce que shadow c'est trop connoté et trace c'est plus générique

/*
- je suis pas fan du tout du fait que ObjectData ait une propriété links alors qu'un objet ne peut avoir que des propriétés
je préfèrerais que seul les objects pouvant avoir d'autres liens aient cette propriété ou alors
on a plusieurs tableaux : properties, entries
les objets ayant autre chose que properties doivent alors redéfinir la méthode createPreviousIterable()
ce serais pas createPreviousIterable mais plus createPreviousIterableByPropertyLink()
ou en tous cas findPreviousDataByValue() afin de tenir compte de properties mais aussi de entries et autre
*/

function insertBefore(array, before, entry) {
    const index = array.indexOf(before);
    if (index === -1) {
        array.push(entry);
    } else {
        array.splice(index, 0, entry);
    }
}

const Trace = util.extend({
    scan(value) {
        const trace = this.from(value);
        // data.populate();
        return trace;
    },

    from(value) {
        const TracePrototypeMatchingValue = this.match(value);
        const trace = TracePrototypeMatchingValue.create(value);
        return trace;
    },

    match(value) {
        if (arguments.length === 0) {
            throw new Error('Trace.match expect one arguments');
        }
        let TracePrototypeMatchingValue = this.TracePrototypes.find(function(TracePrototype) {
            return TracePrototype.match(value);
        });
        if (!TracePrototypeMatchingValue) {
            throw new Error('no registered trace matches value ' + value);
        }
        return TracePrototypeMatchingValue;
    },
    TracePrototypes: [],

    constructor() {
        let value;
        if (arguments.length > 0) {
            value = arguments[0];
        } else {
            value = this.createDefaultValue();
        }

        this.value = value;
        this.initialize(value);
    },

    createDefaultValue() {

    },

    initialize() {

    },

    extend(...args) {
        const TracePrototype = util.extend.apply(this, args);
        insertBefore(this.TracePrototypes, this, TracePrototype);
        return TracePrototype;
    }
});

const ObjectTrace = Trace.extend({
    match(value) {
        return this.Prototype.isPrototypeOf(value);
    },
    Prototype: Object.prototype,

    constructor() {
        this.properties = [];
        Trace.constructor.apply(this, arguments);
    },

    createDefaultValue() {
        return {};
    },

    initialize() {
        this.initializePropertiesGuard();
        this.initializeProperties();
    },

    initializePropertiesGuard() {
        const value = this.value;

        if (Object.isFrozen(value)) {
            this.markAs('frozen');
        } else if (Object.isSealed(value)) {
            this.markAs('sealed');
        } else if (Object.isExtensible(value) === false) {
            this.markAs('non-extensible');
        }
    },

    markAs() {
        this.propertiesGuard = 'frozen';
    },
    propertiesGuard: 'none',

    initializeProperties() {
        const propertyNames = this.listPropertyNames();

        propertyNames.forEach(function(name) {
            this.addProperty(name, Object.getOwnPropertyDescriptor(this.value, name));
        }, this);
    },

    listPropertyNames() {
        return Object.getOwnPropertyNames(this.value);
    },

    addProperty(propertyName, attributes) {
        let property = ObjectProperty.create(this, propertyName, attributes);
        return property;
    }
});

const PrimitiveTrace = Trace.extend({

});

const ObjectProperty = util.extend({
    objectTrace: null,
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

    constructor(objectTrace, name, attributes) {
        this.objectTrace = objectTrace;
        this.name = name;
        this.attributes = attributes;

        objectTrace.properties.push(this);
        this.initialize();
    },

    initialize() {
        const attributes = this.attributes;

        if ('value' in attributes) {
            // console.log('add child from value', propertyDescriptor.value);
            this.value = this.createTrace(attributes.value);
        } else {
            const getter = attributes.get;
            if (getter) {
                this.get = this.createTrace(attributes.get);
            }
            const setter = attributes.set;
            if (setter) {
                this.set = this.createTrace(attributes.set);
            }
        }
    },

    createTrace(value) {
        let trace = Trace.from(value);

        trace.property = this;

        if (trace.referencable) {
            const previousTraceUsingSameValue = trace.findPreviousTraceByValue(trace.value);
            if (previousTraceUsingSameValue) {
                trace.pointTo(previousTraceUsingSameValue);
            }
        }

        return trace;
    }
});

// any trace may now be referenced by property
// Iwould pref to have something like TraceLinkedByProperty but I don't get how I could make it inherit
// from the right TracePrototype
PrimitiveTrace.define({
    property: null
});

ObjectTrace.define({
    referencable: true,

    findPreviousTraceByValue(value) {
        let previousTraceUsingValue;
        for (let previousTrace of this.createPreviousTraceIterable()) {
            if (previousTrace.value === value) {
                previousTraceUsingValue = previousTrace;
                break;
            }
        }
        return previousTraceUsingValue;
    }
});

Trace.define((function createIterationMethods() {
    var properties = {
        createPreviousTraceIterable() {
            let trace = this;

            return createIterable(function() {
                let previousTrace = trace.getPreviousTrace();
                trace = previousTrace;

                const result = {
                    done: !previousTrace,
                    value: previousTrace
                };
                return result;
            });
        },

        getPreviousTrace() {
            let previousTrace;

            const property = this.property;
            if (property) {
                if (this === property.value) {
                    previousTrace = getDeepestTraceBeforeProperty(property);
                } else if (this === property.get) {
                    previousTrace = getDeepestTraceBeforeProperty(property);
                } else if (this === property.set) {
                    previousTrace = property.get.getDeepestTrace() || property.get;
                }
            }

            return previousTrace;
        },

        getDeepestTrace() {
            return null;
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

    function getDeepestTraceBeforeProperty(property) {
        let propertyOwner = property.objectTrace;
        let ownerProperties = propertyOwner.properties;
        let propertyIndex = ownerProperties.indexOf(property);
        let deepestTrace;

        if (propertyIndex === -1) {
            throw new Error(property + 'not found in its owner properties');
        }
        if (propertyIndex === 0) {
            deepestTrace = propertyOwner;
        } else {
            const previousProperty = ownerProperties[propertyIndex - 1];
            deepestTrace = previousProperty.getDeepestTrace();
        }

        // console.log('the deepestData before', link.name, 'is', deepestData.value, 'by the link', deepestData.link.name);

        return deepestTrace;
    }

    ObjectProperty.define({
        getDeepestTrace() {
            let deepestTrace;

            if (this.hasOwnProperty('value')) {
                deepestTrace = this.value;
            } else if (this.hasOwnProperty('set')) {
                deepestTrace = this.set;
            } else {
                deepestTrace = this.get;
            }

            return deepestTrace;
        }
    });

    ObjectTrace.define({
        getDeepestTrace() {
            let deepestTrace = null;
            let currentTrace = this;

            while (true) { // eslint-disable-line
                const properties = currentTrace.properties;
                const propertiesLength = properties.length;

                if (propertiesLength === 0) {
                    break;
                }

                const lastProperty = properties[propertiesLength - 1];
                const lastPropertyDeepestTrace = lastProperty.getDeepestTrace();

                currentTrace = lastPropertyDeepestTrace;
                deepestTrace = lastPropertyDeepestTrace;
            }

            return deepestTrace;
        }
    });

    return properties;
})());

ObjectTrace.define({
    // createPointer() {
    //     const pointerData = Trace.create(this.value);
    //     pointerData.pointTo(this);
    //     return pointerData;
    // },

    pointTo(data) {
        // here we should remove all stuff relative to populate()
        // like children and other properties created by it
        // an other way to do this would be to create a new node with only.data property
        // and to do this.replace(pointerNode)

        const pointedNode = data.pointedNode;
        if (pointedNode) {
            data = pointedNode;
        }
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
ObjectTrace.define({
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
            configurable: true,
            enumerable: true,
            value: value,
            writable: true
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

// boolean primitive
PrimitiveTrace.extend({
    match(value) {
        return typeof value === 'boolean';
    },

    createDefaultValue() {
        return false;
    }
});
// string primitive
PrimitiveTrace.extend({
    match(value) {
        return typeof value === 'string';
    },

    createDefaultValue() {
        return '';
    }
});

export default Trace;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('manual object trace', function() {
            let object = ObjectTrace.create();
            let fooProperty = object.set('foo', true);
            let barProperty = object.set('bar', true);

            assert(object.properties.length === 2);
            assert(object.properties[0] === fooProperty);
            assert(object.properties[1] === barProperty);

            let previousTraces = Array.from(barProperty.value.createPreviousTraceIterable());
            assert(previousTraces.length === 2);
            assert(previousTraces[0].value === true);
            assert(previousTraces[1].value === object.value);
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
