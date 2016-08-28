import util from './util.js';

let ReferenceMap = util.createConstructor({
    constructor() {
        this.values = [];
        this.references = [];
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
    parent: null,

    constructor() {
        this.references = [];
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

    merge(definition) {
        let self = this;
        let referenceMap = new ReferenceMap();

        function copyProperty(property) {
            let propertyDefinition = property.definition;
            let CopyConstructor = property.constructor;
            let copyName = property.name;
            let copyDefinition = new propertyDefinition.constructor();

            let reference = propertyDefinition.reference;
            if (reference) {
                let seenReference = referenceMap.get(reference);
                let copyReference;
                if (seenReference) {
                    copyReference = seenReference;
                } else {
                    copyReference = reference;
                }
                // console.log('add a property which is a reference to', reference);
                copyDefinition.reference = copyReference;
                copyReference.references.push(copyDefinition);
            } else {
                // console.log('add the property', property);
                Object.assign(copyDefinition, propertyDefinition);
                copyDefinition.properties = [];
                mergeProperties(copyDefinition, propertyDefinition.properties);
            }

            let propertyCopy = new CopyConstructor();
            propertyCopy.name = copyName;
            propertyCopy.definition = copyDefinition;
            return propertyCopy;
        }

        function mergeProperties(definition, properties) {
            let definitionProperties = definition.properties;

            for (let property of properties) {
                let propertyDefinition = property.definition;
                let selfProperty = definitionProperties.find(function(selfProperty) {
                    return selfProperty.name === property.name;
                });

                if (selfProperty) {
                    let selfPropertyDefinition = selfProperty.definition;

                    if (
                        selfPropertyDefinition.primitiveMark ||
                        propertyDefinition.primitiveMark
                    ) {
                        let replacementProperty = copyProperty(property);
                        let propertyIndex = definitionProperties.indexOf(selfProperty);
                        definitionProperties[propertyIndex] = replacementProperty;

                        let selfPropertyDefinitionReference = selfPropertyDefinition.reference;
                        if (selfPropertyDefinitionReference) {
                            selfPropertyDefinitionReference.removeReference(propertyDefinition);
                        }
                    } else {
                        mergeDefinition(selfPropertyDefinition, propertyDefinition);
                    }
                } else {
                    let newProperty = copyProperty(property);
                    definitionProperties.push(newProperty);
                }
            }
        }

        function mergeDefinition(definition, mergedDefinition) {
            referenceMap.set(mergedDefinition, definition);
            // ne faire ça redirect qu'une fois serait mieux mais
            // je pense pas que le code permette à une même definition de rapeller cette partie du code

            definition.value = mergedDefinition.value;

            if (mergedDefinition.primitiveMark) {
                // we should also remove this.tag, this.properties etc...
            } else {
                mergeProperties(definition, mergedDefinition.properties);
            }
        }

        mergeDefinition(self, definition);
    }
});

let Property = util.createConstructor({
    name: '',
    definition: null,
    writable: true,
    configurable: true,
    enumerable: true,
    getter: undefined,
    setter: undefined,
    inherited: false,

    constructor() {

    }
});

Definition.from = function(value) {
    let referenceMap = new ReferenceMap();

    function createValueProperties(value) {
        return Object.getOwnPropertyNames(value).map(function(key) {
            let propertyDescriptor = Object.getOwnPropertyDescriptor(value, key);
            let property = new Property();
            property.name = key;

            if ('value' in propertyDescriptor) {
                property.writable = propertyDescriptor.writable;
                property.configurable = propertyDescriptor.configurable;
                property.enumerable = propertyDescriptor.enumerable;
                property.definition = createDefinition(propertyDescriptor.value);
            } else {
                if ('set' in propertyDescriptor) {
                    property.setter = propertyDescriptor.set;
                }
                if ('get' in propertyDescriptor) {
                    property.getter = propertyDescriptor.get;
                }
                property.configurable = propertyDescriptor.configurable;
                property.enumerable = propertyDescriptor.enumerable;
                property.definition = new Definition();
            }

            return property;
        });
    }

    function createDefinition(value) {
        let definition;
        let reference = referenceMap.get(value);
        if (reference) {
            definition = new Definition();
            definition.reference = reference;
            reference.references.push(definition);
        } else {
            definition = new Definition();
            referenceMap.set(value, definition);
            definition.value = value;

            if (util.isPrimitive(value)) {
                definition.primitiveMark = true;
            } else {
                // let toStringResult = Object.prototype.toString.call(value);
                // definition.tag = toStringResult.slice('[object '.length, -(']'.length));
                // etc, some value may define constructor arguments
                // frozen sealed etc to be done
                definition.prototypeValue = Object.getPrototypeOf(value);

                if (typeof value === 'object' || typeof value === 'function') {
                    definition.properties = createValueProperties(value);
                }
            }
        }

        return definition;
    }

    return createDefinition(value);
};

export default Definition;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            let value = {
                date: new Date(),
                user: {

                },
                bar: true
            };
            value.user.self = value;
            let definition = Definition.from(value);

            assert(definition.value === value);
            assert(definition.getPropertyNames().join() === 'date,user,bar');
            assert(definition.getProperty('date').definition.value === value.date);
            assert(definition.getProperty('user').definition.value === value.user);
            assert(definition.getProperty('bar').definition.value === true);
            assert(definition.getProperty('user').definition.getProperty('self').definition.reference === definition);
        });

        this.add('merge deep with removed reference', function() {
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
            // let damDefinition = aDefinition.getProperty('user').definition.getProperty('name').definition;
            aDefinition.merge(bDefinition);
            assert(aDefinition.getPropertyNames().join() === 'user');
            let userDefinition = aDefinition.getProperty('user').definition;
            assert(userDefinition.getPropertyNames().join() === 'name,age');
            let userNameDefinition = userDefinition.getProperty('name').definition;
            assert(userNameDefinition.value === 'seb');
            assert(aDefinition.references.length === 0);
        });

        this.add('merge with deep cycle', function() {
            // {
            //     tag: 'object',
            //     properties: [
            //         {
            //             name: 'user',
            //             definition: {
            //                 tag: 'object',
            //                 properties: [
            //                     {
            //                         name: 'origin',
            //                         definition: // reference to rootDefinition
            //                     }
            //                 ]
            //             }
            //         },
            //     ]
            // }

            let a = {
                user: 10
            };
            let b = {
                user: {

                }
            };
            b.user.origin = b;
            let aDefinition = Definition.from(a);
            let bDefinition = Definition.from(b);
            aDefinition.merge(bDefinition);
            assert(aDefinition.getPropertyNames().join() === 'user');
            let userDefinition = aDefinition.getProperty('user').definition;
            assert(userDefinition.getPropertyNames().join() === 'origin');
            let originDefinition = userDefinition.getProperty('origin').definition;
            assert(originDefinition.reference === aDefinition);
            assert(aDefinition.references.length === 1);
            assert(aDefinition.references[0] === originDefinition);
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
            aDefinition.merge(bDefinition);
            let barDefinition = aDefinition.getProperty('bar').definition;
            let barSelfDefinition = barDefinition.getProperty('self').definition;
            assert(barSelfDefinition.reference === barDefinition);
            assert(barDefinition.references[0] === barSelfDefinition);
        });
    }
};
