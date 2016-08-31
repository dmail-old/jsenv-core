import util from './util.js';

// it must support Map, Set
// the correct way of doing things with such stuff
// is to register something else than a property
// because it must be set using something else a function call
// to do this Property must be renamed into something like revivingStep
// or step, let's call it step for now
// a Set object must be reconstructed from what is inside it
// and we must also duplicate what is inside it
// we must also define a merging strategy for step of Set
// and define how Array & Set merge together and how a property step merge with a callStep
// how Set does merge with Array
// and this changes everything now I must be able to configure specific behaviour
// I have to think about it
// I keep properties but I add something like methods
// which is an array of methods to call on the value
// with arguments having all a definition

// ok it's now different, there is a concept of private properties
// they are properties not available directly but that belongs to the object
// for now I don't see anything else that could need something more
// even if coms object have something private I suppose it can always be represented as a private property
// now we have this we may want to merge properties & privateProperties in a single array and have a private boolean?
// for now let's as it is
// let's remember something important : adoptProperties which is what proto.extend will use under the hood
// if you pass a Set its private properties will be ignored, is that what we want ?
// I think yes when definition does not support privateProperties (hasOwnProperty('privateProperties') === false)
// but when it does like proto.extend(Set, new Set(['ok'])); I must get the 'ok' property in the first Set
// so maybe that putting all inside properties with private flag + some flag on the object saying hey I support private properties
// would be good
// I think we should also add something more
// an object may support private properties only coming from other type of object
// Set will not support private properties of Map (because Map have name + value and set have only value)
// or we could consider Set private properties as indexed -> yep
// so for now just something like privatePropertiesMark: Boolean default false
// Map will support private properties of Set

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

    // inherited: false,

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

let Definition = util.createConstructor({
    value: undefined,
    primitiveMark: false,
    propertiesGuard: 'none', // 'none', 'frozen', 'sealed', 'non-extensible'
    prototypeValue: undefined,
    properties: [],
    privateProperties: [],
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
            this.referenceMap = new util.ReferenceMap();
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
            let property = new Property();
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

    analyzePrivateProperties(value) {
        // for Map for example
        if (value instanceof Map) {
            // maybe method is not the right thing after all
            // it more like something difference of properties
            // like internalProperties which are not available from the outsite
            // but still usefull to be aware of
            // and needed later
            let privateProperties = [];
            for (let entry of value.entries()) {
                let privateProperty = new Property();

                privateProperty.name = entry[0];
                privateProperty.valueDefinition = this.createDefinitionForProperty(entry[1]);
                privateProperties.push(privateProperty);
            }
            this.privateProperties = privateProperties;
        }
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
            this.prototypeValue = Object.getPrototypeOf(value);

            if (Object.isFrozen(value)) {
                this.propertiesGuard = 'frozen';
            } else if (Object.isSealed(value)) {
                this.propertiesGuard = 'sealed';
            } else if (Object.isExtensible(value) === false) {
                this.propertiesGuard = 'non-extensible';
            }

            if (typeof value === 'object' || typeof value === 'function') {
                this.analyzeProperties(value);
            }
        }
    },

    copyProperty(property) {
        // console.log('copy the property', property.name);
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
            // console.log('a reference to', reference.value, 'marked as unreachable');
            // je suis une référence je dois disparaitre
            reference.removeReference(this);
        } else {
            // console.log(this.value, 'marked as unreachable');

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

            this.privateProperties.forEach(function(privateProperty) {
                privateProperty.markAsUnreachable();
            });
        }
    },

    mergeProperty(selfProperty, property) {
        if (property.hasOwnProperty('valueDefinition')) {
            if (selfProperty.hasOwnProperty('valueDefinition')) {
                // both property have valueDefinition
                selfProperty.writable = property.writable;
                selfProperty.enumerable = property.enumerable;
                selfProperty.configurable = property.configurable;
                selfProperty.valueDefinition.merge(property.valueDefinition);
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
                        selfProperty.getDefinition.merge(property.getDefinition);
                    } else {
                        selfProperty.getDefinition = this.copyDefinition(property.getDefinition);
                    }
                }
                if (property.hasOwnProperty('setDefinition')) {
                    if (selfProperty.hasOwnProperty('setDefinition')) {
                        selfProperty.setDefinition.merge(property.setDefinition);
                    } else {
                        selfProperty.setDefinition = this.copyDefinition(property.setDefinition);
                    }
                }
            }
        }
    },

    addProperty(property) {
        let selfProperty = this.properties.find(function(selfProperty) {
            return selfProperty.name === property.name;
        });
        let modifiedProperty;

        if (selfProperty) {
            this.mergeProperty(selfProperty, property);
            modifiedProperty = selfProperty;
        } else {
            let newProperty = this.copyProperty(property);
            this.properties.push(newProperty);
            modifiedProperty = newProperty;
        }

        return modifiedProperty;
    },

    addPrivateProperty(privateProperty) {
        let selfPrivateProperty = this.privateProperties.find(function(selfPrivateProperty) {
            return selfPrivateProperty.name === privateProperty.name;
        });
        let modifiedProperty;

        if (selfPrivateProperty) {
            this.mergeProperty(selfPrivateProperty, privateProperty);
            modifiedProperty = selfPrivateProperty;
        } else {
            let newProperty = this.copyProperty(privateProperty);
            this.privateProperties.push(newProperty);
            modifiedProperty = newProperty;
        }

        return modifiedProperty;
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

    adoptPrivateProperties(definition) {
        if (definition.hasOwnProperty('privateProperties')) {
            // console.log('adopting properties of', definition.value);
            definition.privateProperties.forEach(function(privateProperty) {
                this.addPrivateProperty(privateProperty);
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
            // console.log(definition.value, 'marked as reference during merge');
            this.reference = reference;
            reference.references.push(this);
        } else {
            // et primitive mark et tout le bordel faudrais aussi le reset et oui
            // il faut vraiment disccier le merge du adopt ou become
            // console.log('merging', this.value, 'with', definition.value);
            this.markAsUnreachable();
            delete this.value;
            this.adoptValue(definition);
            // console.log('register further reference to', definition.value);
            this.referenceMap.set(definition.value, this);
            this.adoptProperties(definition);
            this.adoptPrivateProperties(definition);
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
            // console.log(definition.value, 'marked as reference during merge');
            this.reference = reference;
            reference.references.push(this);
        } else {
            this.value = definition.value;
            this.propertiesGuard = definition.propertiesGuard;
            this.referenceMap.set(this.value, this);
            this.properties = [];
            this.adoptProperties(definition);
            this.privateProperties = [];
            this.adoptPrivateProperties(definition);
        }
    },

    copyDefinition(definition) {
        let definitionReference = definition.reference;
        if (definitionReference) {
            definition = definitionReference;
        }

        // console.log('copy the definition', definition.value);

        let definitionCopy = new definition.constructor(this);
        let reference = this.referenceMap.get(definition.value);
        // console.log('searched for reference to', definition.value, 'found', Boolean(reference));
        if (reference) {
            // console.log('marked as a reference to', definition.value, 'during copy');
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
        if (definition.hasOwnProperty('privateProperties')) {
            concatenedDefinition.privateProperties = [];
            concatenedDefinition.adoptPrivateProperties(selfDefinition);
            concatenedDefinition.adoptPrivateProperties(definition);
        }

        return concatenedDefinition;
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
            this.add('object definition', function() {
                let value = {
                    date: new Date(),
                    bar: true,
                    user: {

                    }
                };
                let definition = Definition.from(value);
                assert(definition.value === value);
                assert(definition.getPropertyNames().join() === 'date,bar,user');
                assert(definition.getProperty('date').valueDefinition.value === value.date);
                assert(definition.getProperty('bar').valueDefinition.value === true);
                assert(definition.getProperty('user').valueDefinition.value === value.user);
            });

            this.add('circular structure', function() {
                let value = {

                };
                value.self = value;
                let definition = Definition.from(value);
                let selfDefinition = definition.getProperty('self').valueDefinition;
                assert(selfDefinition.reference === definition);
                assert(definition.references.length === 1);
                assert(definition.references[0] === selfDefinition);
            });

            this.add('reference on value & getter/setter', function() {
                let getter = function() {};
                let setter = function() {};
                let value = {
                    hidden: true,
                    disabled: true
                };
                Object.defineProperty(value, 'name', {get: getter, set: setter});
                Object.defineProperty(value, 'nameGetter', {get: getter});
                let definition = Definition.from(value);
                let hiddenDefinition = definition.getProperty('hidden').valueDefinition;
                let disabledDefinition = definition.getProperty('disabled').valueDefinition;
                assert(disabledDefinition.reference === hiddenDefinition);
                let nameProperty = definition.getProperty('name');
                let nameGetterProperty = definition.getProperty('nameGetter');
                assert(nameGetterProperty.getDefinition.reference === nameProperty.getDefinition);
            });
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

        this.add('concat with cycle in properties', function() {
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
