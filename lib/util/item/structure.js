/*

var value = {
    foo: Date.now(),
    user: {
        name: 'dam'
    }
};
value.self = value;

var structure = {
    value: {
        tag: 'Object',
    },
    properties: [
        {
            name: 'foo',
            value: {
                tag: 'Date',
                constructorArguments: [1471938451955]
            }
        },
        {
            name: 'user',
            value: {
                tag: 'Object',
            },
            properties: [
                {
                    name: 'name',
                    value: 'dam'
                }
            ]
        }
        {
            name: 'self',
            value: // a pointer to structure
            // the problem here is that we won't be aware that node is a reference
            // it doesn't solve the issue, we could create a referenceNode or pointerNode for thoose special case
            // and when we meet one we know the node must not be iterated as it's a reference to something we have already seen
        }
    ]
};

would be serialized to, we need more than that to be able to recreate the structure

{
    values: [
        {tag: 'Object'},
        {tag: 'Date', constructorArguments: [1471938451955]},
        {tag: 'Object'},
        'dam'
        // here object properties are tag, constructorArguments, frozen, sealed, extensible
    ],
    properties: [
        {owner: 0, name: 'foo', value: 1},
        {owner: 0, name: 'user', value: 2},
        {owner: 2, name: 'name', value: 3},
        {owner: 0, name: 'self', value: 0}
        // here properties properties are owner, name, value, configurable, writable, enumerable, getter, setter
    ]
}

how merge can work ?

*/

import util from './util.js';

let RedirectionHandler = util.createConstructor({
    constructor() {
        this.values = [];
        this.redirections = [];
    },

    redirect(sourceValue, targetValue) {
        let valueIndex = this.values.indexOf(sourceValue);
        let index;
        if (valueIndex === -1) {
            index = this.values.length;
            this.values[index] = sourceValue;
        } else {
            index = valueIndex;
        }

        this.redirections[index] = targetValue;
    },

    locate(value) {
        let redirectedValue;
        let valueIndex = this.values.indexOf(value);
        if (valueIndex > -1) {
            redirectedValue = this.redirections[valueIndex];
        } else {
            redirectedValue = value;
        }
        return redirectedValue;
    }
});

let Definition = util.createConstructor({
    value: undefined,
    tag: '',
    constructorArguments: [],
    frozen: false,
    sealed: false,
    extensible: true,
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
        let redirectionHandler = new RedirectionHandler();

        function copyProperty(property) {
            let propertyDefinition = property.definition;
            let CopyConstructor = property.constructor;
            let copyName = property.name;
            let copyDefinition = new propertyDefinition.constructor();

            let reference = propertyDefinition.reference;
            if (reference) {
                let redirectedReference = redirectionHandler.locate(reference);
                // console.log('add a property which is a reference to', reference);
                copyDefinition.reference = redirectedReference;
                redirectedReference.references.push(copyDefinition);
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
                        selfPropertyDefinition.hasOwnProperty('value') ||
                        propertyDefinition.hasOwnProperty('value')
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
            redirectionHandler.redirect(mergedDefinition, definition);
            // ne faire ça redirect qu'une fois serait mieux mais
            // je pense pas que le code permette à une même definition de rapeller cette partie du code

            if (mergedDefinition.hasOwnProperty('value')) {
                definition.value = mergedDefinition.value;
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

    constructor() {

    }
});

Definition.from = function(value) {
    let values = [];
    let definitions = [];

    function createValueProperties(value) {
        return Object.keys(value).map(function(key) {
            let propertyValue = value[key];
            let property = new Property();
            property.name = key;
            property.definition = createDefinition(propertyValue);
            return property;
        });
    }

    function createDefinition(value) {
        let index = values.indexOf(value);
        let definition;
        if (index === -1) {
            definition = new Definition();

            if (util.isPrimitive(value)) {
                definition.value = value;
            } else {
                let toStringResult = Object.prototype.toString.call(value);
                definition.tag = toStringResult.slice('[object '.length, -(']'.length));
                // etc, some value may define constructor arguments
                // frozen sealed etc to be done
            }

            values.push(value);
            definitions.push(definition);
            if (typeof value === 'object') {
                definition.properties = createValueProperties(value);
            }
        } else {
            let seenDefinition = definitions[index];
            definition = new Definition();
            definition.reference = seenDefinition;
            seenDefinition.references.push(definition);
        }

        return definition;
    }

    return createDefinition(value);
};

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

            assert(definition.tag === 'Object');
            assert(definition.getPropertyNames().join() === 'date,user,bar');
            assert(definition.getProperty('date').definition.tag === 'Date');
            assert(definition.getProperty('user').definition.tag === 'Object');
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
