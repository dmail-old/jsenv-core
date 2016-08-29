import util from './util.js';

let ReferenceMap = util.createConstructor({
    constructor() {
        this.values = [];
        this.references = [];
    },

    delete(value) {
        let valueIndex = this.values.indexOf(value);
        if (valueIndex > -1) {
            this.values.splice(valueIndex, 1);
            this.references.splice(valueIndex, 1);
        }
    },

    set: function(value, reference) {
        let valueIndex = this.values.indexOf(value);
        let index;
        if (valueIndex === -1) {
            index = this.values.length;
            this.values[index] = value;
        } else {
            index = valueIndex;
        }

        this.references[index] = reference;
    },

    get: function(value) {
        let reference;
        let valueIndex = this.values.indexOf(value);
        if (valueIndex > -1) {
            reference = this.references[valueIndex];
        } else {
            reference = null;
        }
        return reference;
    }
});

let Definition = util.createConstructor({
    value: undefined,
    primitiveMark: false,
    frozenMark: false,
    sealedMark: false,
    extensibleMark: true,
    prototypeValue: undefined,
    properties: [],
    references: [],
    referenceMap: null,
    reference: null,
    parent: null,

    constructor(parent) {
        this.references = [];
        if (parent) {
            this.parent = parent;
            this.referenceMap = this.parent.referenceMap;
        } else {
            this.parent = null;
            this.referenceMap = new ReferenceMap();
        }
    },

    get path() {
        let path = [];
        let definition = this;
        let parent = definition.parent;
        while (parent) {
            let property = parent.properties.find(function(property) { // eslint-disable-line
                return property.valueDefinition === definition;
            });
            if (!property) {
                console.log('parent', parent.value, 'has not', definition, 'in its properties');
            }
            path.unshift(property.name);
            definition = parent;
            parent = definition.parent;
        }
        return path;
    },

    getPropertyNames() {
        return this.properties.map(function(property) {
            return property.name;
        });
    },

    getProperty(name) {
        return this.properties.find(function(property) {
            return property.name === name;
        });
    },

    removeReference(reference) {
        let index = this.references.indexOf(reference);
        this.references.splice(index, 1);
    },

    createDefinitionForProperty(value) {
        let propertyDefinition = new this.constructor(this);

        let reference = this.referenceMap.get(value);
        if (reference) {
            propertyDefinition.reference = reference;
            reference.references.push(propertyDefinition);
        } else {
            propertyDefinition.analyze(value);
        }

        return propertyDefinition;
    },

    analyzeProperties(value) {
        this.properties = Object.getOwnPropertyNames(value).map(function(key) {
            let propertyDescriptor = Object.getOwnPropertyDescriptor(value, key);
            let property = new Property(); // eslint-disable-line
            property.name = key;

            if ('value' in propertyDescriptor) {
                property.populateDescriptorDefinition(propertyDescriptor, 'writable');
                property.populateDescriptorDefinition(propertyDescriptor, 'configurable');
                property.populateDescriptorDefinition(propertyDescriptor, 'enumerable');
                property.valueDefinition = this.createDefinitionForProperty(propertyDescriptor.value);
            } else {
                let setter = propertyDescriptor.set;
                if (setter) {
                    property.setDefinition = this.createDefinitionForProperty(setter);
                }
                let getter = propertyDescriptor.get;
                if (getter) {
                    property.getDefinition = this.createDefinitionForProperty(getter);
                }
                property.populateDescriptorDefinition(propertyDescriptor, 'configurable');
                property.populateDescriptorDefinition(propertyDescriptor, 'enumerable');
            }

            return property;
        }, this);
    },

    analyze(value) {
        if (this.hasOwnProperty('value')) {
            throw new Error('definition.analyze() must not be called once value is set');
        }

        this.referenceMap.set(value, this);
        this.value = value;

        if (util.isPrimitive(value)) {
            this.primitiveMark = true;
        } else {
            // let toStringResult = Object.prototype.toString.call(value);
            // definition.tag = toStringResult.slice('[object '.length, -(']'.length));
            // etc, some value may define constructor arguments
            // frozen sealed etc to be done
            this.prototypeValue = Object.getPrototypeOf(value);

            if (typeof value === 'object' || typeof value === 'function') {
                this.analyzeProperties(value);
            }
        }
    },

    copyProperty(property) {
        console.log('copy the property', property.name);
        let CopyConstructor = property.constructor;
        let propertyCopy = new CopyConstructor();

        Object.assign(propertyCopy, property);
        if (property.hasOwnProperty('valueDefinition')) {
            // console.log('copy its value definition', property.valueDefinition.value);
            propertyCopy.valueDefinition = this.copyDefinition(property.valueDefinition);
        } else {
            if (property.hasOwnProperty('getDefinition')) {
                propertyCopy.getDefinition = this.copyDefinition(property.getDefinition);
            }
            if (property.hasOwnProperty('setDefinition')) {
                propertyCopy.setDefinition = this.copyDefinition(property.setDefinition);
            }
        }

        return propertyCopy;
    },

    // markAsUnReferenced
    markAsUnreachable() {
        let reference = this.reference;

        if (reference) {
            console.log('a reference to', reference.value, 'marked as unreachable');
            // je suis une référence je dois disparaitre
            reference.removeReference(this);
        } else {
            console.log(this.value, 'marked as unreachable');

            let mappedReference = this.referenceMap.get(this.value);
            if (mappedReference === this) {
                this.referenceMap.delete(this.value); // only IF we are the reference to this value
            }

            // je dois aussi marquer tous mes enfants comme unreachable ettttt oui
            this.properties.forEach(function(property) {
                if (property.hasOwnProperty('valueDefinition')) {
                    property.valueDefinition.markAsUnreachable();
                } else {
                    if (property.hasOwnProperty('getDefinition')) {
                        property.getDefinition.markAsUnreachable();
                    }
                    if (property.hasOwnProperty('setDefinition')) {
                        property.setDefinition.markAsUnreachable();
                    }
                }
            });
        }
    },

    mergeDefinitionForProperty(property, definition, mergedDefinition) {
        // let definitionReference = definition.reference;
        // if (definitionReference) {
        //     definition = definitionReference;
        // }
        // let mergedDefinitionReference = mergedDefinition.reference;
        // if (mergedDefinitionReference) {
        //     mergedDefinition = mergedDefinitionReference;
        // }

        // if (definition.value === mergedDefinition.value) {
        //     // console.log('property', property.name, 'use same value at', this.path.join(), 'aborting the merge');
        // } else {
        console.log(
            'property',
            property.name,
            'will be updated from',
            definition.value,
            'to',
            mergedDefinition.value
        );
        definition.merge(mergedDefinition);
        // }
    },

    mergePropertyAt(index, property) {
        let selfProperty = this.properties[index];

        if (property.hasOwnProperty('valueDefinition')) {
            if (selfProperty.hasOwnProperty('valueDefinition')) {
                // both property have valueDefinition
                selfProperty.writable = property.writable;
                selfProperty.enumerable = property.enumerable;
                selfProperty.configurable = property.configurable;
                this.mergeDefinitionForProperty(property, selfProperty.valueDefinition, property.valueDefinition);
            } else {
                selfProperty.writable = property.writable;
                selfProperty.enumerable = property.enumerable;
                selfProperty.configurable = property.configurable;

                // self is getter/setter, merged is classic
                if (selfProperty.hasOwnProperty('setDefinition')) {
                    selfProperty.setDefinition.markAsUnreachable();
                    delete selfProperty.setDefinition;
                }
                if (selfProperty.hasOwnProperty('getDefinition')) {
                    selfProperty.getDefinition.markAsUnreachable();
                    delete selfProperty.getDefinition;
                }
                selfProperty.valueDefinition = this.copyDefinition(property.valueDefinition);
            }
        } else {
            // we should merge enumerable, configurable but also other own property set on mergedProperty
            selfProperty.enumerable = property.enumerable;
            selfProperty.configurable = property.configurable;

            if (selfProperty.hasOwnProperty('valueDefinition')) {
                delete selfProperty.writable;

                selfProperty.valueDefinition.markAsUnreachable();
                delete selfProperty.valueDefinition;
            } else {
                if (property.hasOwnProperty('getDefinition')) {
                    if (selfProperty.hasOwnProperty('getDefinition')) {
                        this.mergeDefinitionForProperty(property, selfProperty.getDefinition, property.getDefinition);
                    } else {
                        selfProperty.getDefinition = this.copyDefinition(property.getDefinition);
                    }
                }
                if (property.hasOwnProperty('setDefinition')) {
                    if (selfProperty.hasOwnProperty('setDefinition')) {
                        this.mergeDefinitionForProperty(property, selfProperty.setDefinition, property.setDefinition);
                    } else {
                        selfProperty.setDefinition = this.copyDefinition(property.setDefinition);
                    }
                }
            }
        }
    },

    addProperty(property) {
        let selfPropertyIndex = this.properties.findIndex(function(selfProperty) {
            return selfProperty.name === property.name;
        });
        let addedProperty;

        if (selfPropertyIndex === -1) {
            console.log('adding new property', property.name);
            let newProperty = this.copyProperty(property);
            this.properties.push(newProperty);
            addedProperty = newProperty;
        } else {
            console.log(
                'merging property',
                property.name,
                'because there is already a property with that name'
            );
            this.mergePropertyAt(selfPropertyIndex, property);
            addedProperty = this.properties[selfPropertyIndex];
        }

        return addedProperty;
    },

    adoptValue(definition) {
        // inherit own properties of definition, except parent, references, referenceMap
        Object.keys(definition).forEach(function(name) {
            if (this.hasOwnProperty(name) === false) {
                this[name] = definition[name];
            }
        }, this);
    },

    adoptProperties(definition) {
        if (definition.hasOwnProperty('properties')) {
            // console.log('adopting properties of', definition.value);
            definition.properties.forEach(function(property) {
                this.addProperty(property);
            }, this);
        }
    },

    merge(definition) {
        // if the definition is a reference, juste make it a reference as well
        // le problème qu'on a c'est
        let definitionReference = definition.reference;
        if (definitionReference) {
            definition = definitionReference;
        }

        let reference = this.referenceMap.get(definition.value);
        // console.log('searched for reference to', definition.value, 'found', Boolean(reference));
        if (reference) {
            console.log(definition.value, 'marked as reference during merge');
            this.reference = reference;
            reference.references.push(this);
        } else {
            // et primitive mark et tout le bordel faudrais aussi le reset et oui
            // il faut vraiment disccier le merge du adopt ou become
            console.log('merging', this.value, 'with', definition.value);
            this.markAsUnreachable();
            delete this.value;
            this.adoptValue(definition);
            console.log('register further reference to', definition.value);
            this.referenceMap.set(definition.value, this);
            this.adoptProperties(definition);
        }
    },

    // merge(definition) {
    //     let definitionReference = definition.reference;
    //     if (definitionReference) {
    //         definition = definitionReference;
    //     }

    //     let reference = this.referenceMap.get(definition.value);
    //     if (reference) {
    //         console.log(definition.value, 'marked as reference during merge');
    //         this.reference = reference;
    //         reference.references.push(this);
    //     } else {
    //         console.log('merging', this.value, 'with', definition.value);
    //         if (this.hasOwnProperty('value')) {
    //             this.markAsUnreachable();
    //             delete this.value;
    //         }
    //         // copy all but parent, referenceMap, references
    //         Object.keys(definition).forEach(function(name) {
    //             if (this.hasOwnProperty(name) === false) {
    //                 this[name] = definition[name];
    //             }
    //         }, this);
    //         this.referenceMap.set(this.value, this);
    //         this.adoptProperties(definition);
    //     }
    // },

    become(definition) {
        let definitionReference = definition.reference;
        if (definitionReference) {
            definition = definitionReference;
        }

        let reference = this.referenceMap.get(definition.value);
        if (reference) {
            console.log(definition.value, 'marked as reference during merge');
            this.reference = reference;
            reference.references.push(this);
        } else {
            this.value = definition.value;
            this.referenceMap.set(this.value, this);
            this.properties = [];
            this.adoptProperties(definition);
        }
    },

    copyDefinition(definition) {
        let definitionReference = definition.reference;
        if (definitionReference) {
            definition = definitionReference;
        }

        console.log('copy the definition', definition.value);

        let definitionCopy = new definition.constructor(this);
        let reference = this.referenceMap.get(definition.value);
        // console.log('searched for reference to', definition.value, 'found', Boolean(reference));
        if (reference) {
            console.log('marked as a reference to', definition.value, 'during copy');
            definitionCopy.reference = reference;
            reference.references.push(definitionCopy);
        } else {
            definitionCopy.become(definition);
        }

        return definitionCopy;
    },

    concat(definition) {
        // si la définition fait référence à une autre, invalide la
        let selfDefinition = this;
        let selfReference = selfDefinition.reference;
        if (selfReference) {
            selfDefinition = selfReference;
        }
        let definitionReference = definition.reference;
        if (definitionReference) {
            definition = definitionReference;
        }
        let concatenedDefinition = new definition.constructor();

        concatenedDefinition.adoptValue(definition);
        // console.log('register further reference to', definition.value);
        concatenedDefinition.referenceMap.set(definition.value, concatenedDefinition);
        if (definition.hasOwnProperty('properties')) {
            concatenedDefinition.properties = [];
            concatenedDefinition.adoptProperties(selfDefinition);
            concatenedDefinition.adoptProperties(definition);
        }

        return concatenedDefinition;
    }
});

let Property = util.createConstructor({
    name: '',

    // here you can change to what is the most common case for a property
    // I believe it's a writable & configurable & enummerable property
    // setting the most common case allow to reduce the size of the serialized version of a definition
    writable: true,
    configurable: true,
    enumerable: true,

    valueDefinition: null,
    getDefinition: undefined,
    setDefinition: undefined,

    inherited: false,

    constructor() {

    },

    populateDescriptorDefinition(descriptor, name) {
        let value = descriptor[name];
        if (value !== this.constructor[name]) {
            this[name] = value;
        }
    },

    hasDefinition(definition) {
        return (
            this.valueDefinition === definition ||
            this.setDefinition === definition ||
            this.getDefinition === definition
        );
    }
});

Definition.from = function(value) {
    let definition = new Definition();
    definition.analyze(value);
    return definition;
};

export default Definition;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        // to be tested
        // - setter/getter may be referenced and must have their own definition
        // merging of property with getter/setter/value
        // ne set writable, configurable que lorsqu'il sont différent des valeurs par défaut

        this.add('core', function() {
            let value = {
                date: new Date(),
                bar: true,
                user: {

                }
            };
            value.user.self = value;
            let definition = Definition.from(value);

            assert(definition.value === value);
            assert(definition.getPropertyNames().join() === 'date,bar,user');
            assert(definition.getProperty('date').valueDefinition.value === value.date);
            assert(definition.getProperty('bar').valueDefinition.value === true);
            let userDefinition = definition.getProperty('user').valueDefinition;
            assert(userDefinition.value === value.user);
            let selfDefinition = userDefinition.getProperty('self').valueDefinition;
            assert(selfDefinition.reference === definition);
            assert(definition.references.length === 1);
            assert(definition.references[0] === selfDefinition);
        });

        this.add('concat with removed reference', function() {
            let a = {
                user: {
                }
            };
            let b = {
                user: {
                    name: 'seb',
                    age: 10
                }
            };
            a.user.name = a;
            let aDefinition = Definition.from(a);
            let bDefinition = Definition.from(b);
            let cDefinition = aDefinition.concat(bDefinition);
            assert(cDefinition.getPropertyNames().join() === 'user');
            let userDefinition = cDefinition.getProperty('user').valueDefinition;
            assert(userDefinition.getPropertyNames().join() === 'name,age');
            let userNameDefinition = userDefinition.getProperty('name').valueDefinition;
            assert(userNameDefinition.value === 'seb');
            assert(cDefinition.references.length === 0);
        });

        this.add('concat with left deep unreferenced cycle', function() {
            let a = {
                user: {

                }
            };
            a.user.origin = a;
            let b = {};
            let aDefinition = Definition.from(a);
            let bDefinition = Definition.from(b);
            let cDefinition = aDefinition.concat(bDefinition);
            let userDefinition = cDefinition.getProperty('user').valueDefinition;
            let originDefinition = userDefinition.getProperty('origin').valueDefinition;
            let originUserDefinition = originDefinition.getProperty('user').valueDefinition;
            assert(cDefinition.value === b);
            assert(userDefinition.value === a.user);
            assert(originDefinition.value === a);
            assert(originUserDefinition.reference === userDefinition);
        });

        this.add('concat with right deep cycle', function() {
            let a = true;
            let b = {
                user: {

                }
            };
            b.user.origin = b;
            let aDefinition = Definition.from(a);
            let bDefinition = Definition.from(b);
            let cDefinition = aDefinition.concat(bDefinition);
            assert(cDefinition.getPropertyNames().join() === 'user');
            let userDefinition = cDefinition.getProperty('user').valueDefinition;
            assert(userDefinition.getPropertyNames().join() === 'origin');
            let originDefinition = userDefinition.getProperty('origin').valueDefinition;
            assert(originDefinition.reference === cDefinition);
            assert(cDefinition.references.length === 1);
            assert(cDefinition.references[0] === originDefinition);
        });

        this.add('merge with cycle in properties', function() {
            let a = {
                bar: {

                }
            };
            let b = {
                bar: {

                }
            };
            b.bar.self = b.bar;
            let aDefinition = Definition.from(a);
            let bDefinition = Definition.from(b);
            let cDefinition = aDefinition.concat(bDefinition);
            let barDefinition = cDefinition.getProperty('bar').valueDefinition;
            let barSelfDefinition = barDefinition.getProperty('self').valueDefinition;
            assert(barSelfDefinition.reference === barDefinition);
            assert(barDefinition.references[0] === barSelfDefinition);
        });
    }
};
