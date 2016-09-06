import util from './util.js';

/*

first we must stabilize the api and tests on basic cases which are
- create value once
- allow for concatenation of Array and prevent Array deep cloning
- implement serialize() & deserialize()
- implement stringify() & parse() which will just JSON.stringify & JSON.parse serialize/deserialize outputs
- update the promise polyfill so that it hide internals because else we'll get too much information when scanning them

once the above is done and well tested we'll be able to make definition and generation a bit more powerfull
by being able to handle
- Concatenation of private properties between object
- Request definition/generation
- Response definition/generation
- Headers definition/generation
- Function generation
prevent non configurable property, share prototype, allow binding to instance
- Error definition/generation
generated error must inherit from original error stack, ideally not having to import StackTrace
to do this we must enable something not natively available : get the stack object of an error
to obtain this we must improve a bit the stacktrace lib so that it returns a stack object
*/

/*
about fetch

// for headers be aware of the following
var h = new Headers();
h.append('test', 'a');
h.append('test', 'b');
Array.from(h.entries()); -> [['test', 'a'], ['test', 'b']]

// for Request & Response we have a clone() method that must be used when generating
// Instead of using the classic behaviour because we don't have access to the underlying Request.body
// so for this specific case we'll use the clone() method that will do what we want
*/

/*
about promise

promise are the bad kid here because they represent data but you absolutely
cannot get the current data until it's fully resolved
even worse you could not clone it anyway because you would have to clone the then chain
and everything required to access the resolved data
resulting most time in cloning a huge tree with high chance to meet something not serializable or clonable

what we could do for such object is to keep a pointer on the original object and create a new object waiting for the original one
like -> Promise.resolve(originalPromise) it would work perfectly for shared code
when sharing server code with client code the client could get an adress to listen for where he'll get the value when server is done
resolving the data like "http://domain.com/pending/123" -> and when the promise is resolved client can read it from the AJAX request
*/

/*
about Map, Set, WeakMap, WeakSet

// WeakMap, WeakSet private properties are unknown so you can't get their full definition
// something must be done concerning this kind of element that cannot be generated without loosing stuff
// Map will support private properties of Set
// an object may support private properties only coming from other type of object
// Set will not support private properties of Map (because Map have name + value and set have only value)
// or we could consider Set private properties as indexed -> yep
// so for now just something like privatePropertiesMark: Boolean default false
*/

/*
about collection in general

Array may want to get "privateProperties" of Set, and set may transform Array properties into "privateProperties"
Object may want to get Map "privateProperties" and Map may want to transform Object properties into "privateProperties"
concatenating Array definition may lead to Array concatenation (preventing properties conflict by using free array index)
for Set it doesn't matter they have no index, at least index is not what matters, only value matters
last we may want to say ok concat properties but stop here, do not deepDefine & deepGenerate properties
*/

/*
about function

function scope & this are hidden and cannot be accessed
we can ignore scope and consider this as being the owner of the function, rewrite Function.prototype.bind
so that is retains originalFunction and inform about the function thisValue
but we cannot redefine Function.prototype.call so that it would ignore the bound function and would call on the argument instead
we may do something like when calling function without any this, of with this === to the original object then we know function was
not called using .call or .apply and so we use the bound this, else we use the provided this

var item = proto.extend({
    method() {

    }
});
var m = item.method(); m(); // this is null or undefined or window or global, use item because method.defaultThis exists
m.call(null, 'ok'); // this is null but that's what we want, however it will use defaultThis
m.call({}, true); // this is an object so it's used and defaultThis is ignored, that a good solution
*/

let Property = util.createConstructor({
    definition: null,
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

    constructor(definition) {
        this.definition = definition;
    }
});

let PrivateProperty = util.extendConstructor(Property, {
    privateMark: true
});

let Definition = util.createConstructor({
    value: undefined,
    primitiveMark: false,
    propertiesGuard: 'none', // 'none', 'frozen', 'sealed', 'non-extensible'

    constructor(parent) {
        if (parent) {
            this.parent = parent;
        } else {
            this.parent = null;
        }
    },
    parent: null,

    // get path() {
    //     let path = [];
    //     let definition = this;
    //     let parent = definition.parent;
    //     while (parent) {
    //         let property = parent.properties.find(function(property) { // eslint-disable-line
    //             return property.valueDefinition === definition;
    //         });
    //         if (!property) {
    //             console.log('parent', parent.value, 'has not', definition, 'in its properties');
    //         }
    //         path.unshift(property.name);
    //         definition = parent;
    //         parent = definition.parent;
    //     }
    //     return path;
    // },

    properties: [],
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

    privateProperties: [],
    getPrivateProperty(name) {
        return this.privateProperties.find(function(property) {
            return property.name === name;
        });
    },

    references: [],
    addReference(reference) {
        if (this.hasOwnProperty('references') === false) {
            this.references = [];
        }
        this.references.push(reference);
    },

    removeReference(reference) {
        let index = this.references.indexOf(reference);
        this.references.splice(index, 1);
        if (this.references.length === 0) {
            delete this.references;
        }
    },

    reference: null,
    markAsReferenceTo(reference) {
        this.reference = reference;
        reference.addReference(this);
    }
});

// Definition.from, to create a definition from any js value
var populate = (function() {
    function populate(definition, value, referenceMap) {
        if (!referenceMap) {
            referenceMap = new util.ReferenceMap();
        }

        if (definition.hasOwnProperty('value')) {
            throw new Error('definition.analyze() must not be called once value is set');
        }

        referenceMap.set(value, definition);
        definition.value = value;

        if (util.isPrimitive(value)) {
            definition.primitiveMark = true;
        } else {
            if (Object.isFrozen(value)) {
                definition.propertiesGuard = 'frozen';
            } else if (Object.isSealed(value)) {
                definition.propertiesGuard = 'sealed';
            } else if (Object.isExtensible(value) === false) {
                definition.propertiesGuard = 'non-extensible';
            }

            if (typeof value === 'object' || typeof value === 'function') {
                let properties = createProperties(definition, referenceMap);
                if (properties) {
                    definition.properties = properties;
                }
                let privateProperties = createPrivateProperties(definition, referenceMap);
                if (privateProperties) {
                    definition.privateProperties = privateProperties;
                }
            }
        }
    }

    function createProperties(definition, referenceMap) {
        return Object.getOwnPropertyNames(definition.value).map(function(name) {
            return createProperty(definition, name, referenceMap);
        });
    }

    function createProperty(definition, name, referenceMap) {
        let property = new Property(definition);
        let propertyDescriptor = Object.getOwnPropertyDescriptor(definition.value, name);

        property.name = name;
        if ('value' in propertyDescriptor) {
            populateDescriptorAttribute(property, propertyDescriptor, 'writable');
            populateDescriptorAttribute(property, propertyDescriptor, 'configurable');
            populateDescriptorAttribute(property, propertyDescriptor, 'enumerable');

            property.valueDefinition = createPropertyDefinition(definition, propertyDescriptor.value, referenceMap);
        } else {
            populateDescriptorAttribute(property, propertyDescriptor, 'configurable');
            populateDescriptorAttribute(property, propertyDescriptor, 'enumerable');

            let setter = propertyDescriptor.set;
            if (setter) {
                property.setDefinition = createPropertyDefinition(definition, setter, referenceMap);
            }
            let getter = propertyDescriptor.get;
            if (getter) {
                property.getDefinition = createPropertyDefinition(definition, getter, referenceMap);
            }
        }

        return property;
    }

    function populateDescriptorAttribute(property, propertyDescriptor, name) {
        let value = propertyDescriptor[name];
        if (value !== property.constructor[name]) {
            property[name] = value;
        }
    }

    function createPropertyDefinition(definition, value, referenceMap) {
        let childDefinition = new definition.constructor(definition);
        let reference = referenceMap.get(value);
        if (reference) {
            childDefinition.markAsReferenceTo(reference);
        } else {
            populate(childDefinition, value, referenceMap);
        }
        return childDefinition;
    }

    function createPrivateProperties(definition, referenceMap) {
        let privateProperties;
        var value = definition.value;
        if (value instanceof Map) {
            privateProperties = [];
            for (let entry of value.entries()) {
                let privateProperty = new PrivateProperty(definition);

                privateProperty.name = entry[0];
                privateProperty.valueDefinition = createPropertyDefinition(definition, entry[1], referenceMap);
                privateProperties.push(privateProperty);
            }
        }
        return privateProperties;
    }

    return populate;
})();
Definition.from = function(value) {
    let definition = new Definition();
    populate(definition, value);
    return definition;
};

// Definition.concat, to concat two definition together
var concatDefinition = (function() {
    // function addPrivateProperty(privateProperty) {
    //     let selfPrivateProperty = this.privateProperties.find(function(selfPrivateProperty) {
    //         return selfPrivateProperty.name === privateProperty.name;
    //     });
    //     let modifiedProperty;

    //     if (selfPrivateProperty) {
    //         selfPrivateProperty.merge(privateProperty);
    //         modifiedProperty = selfPrivateProperty;
    //     } else {
    //         let newProperty = this.importProperty(privateProperty);
    //         this.privateProperties.push(newProperty);
    //         modifiedProperty = newProperty;
    //     }

    //     return modifiedProperty;
    // }

    // function adoptValue(definition) {
    //     // inherit own properties of definition, except parent, references, referenceMap
    //     Object.keys(definition).forEach(function(name) {
    //         if (this.hasOwnProperty(name) === false) {
    //             this[name] = definition[name];
    //         }
    //     }, this);
    // }

    // function adoptPrivateProperties(definition) {
    //     // console.log('adopting properties of', definition.value);
    //     definition.privateProperties.forEach(function(privateProperty) {
    //         this.addPrivateProperty(privateProperty);
    //     }, this);
    // }

    function concatDefinition(definition, otherDefinition, referenceMap) {
        if (!referenceMap) {
            referenceMap = new util.ReferenceMap();
        }

        // shouldn't we ensure that otherDefinition is external to definition ?
        // shouldn't we throw when they are reference ?
        let definitionReference = definition.reference;
        if (definitionReference) {
            definition = definitionReference;
        }
        let otherDefinitionReference = otherDefinition.reference;
        if (otherDefinitionReference) {
            otherDefinition = otherDefinitionReference;
        }
        let concatenedDefinition = new otherDefinition.constructor();

        populateDefinitionValue(concatenedDefinition, otherDefinition, referenceMap);
        if (otherDefinition.hasOwnProperty('properties')) {
            if (definition.hasOwnProperty('properties')) {
                populateProperties(concatenedDefinition, definition, referenceMap);
                mergeDefinitionProperties(concatenedDefinition, otherDefinition, referenceMap);
            } else {
                populateProperties(concatenedDefinition, otherDefinition, referenceMap);
            }
        }
        // if (definition.hasOwnProperty('privateProperties')) {

        //     popul(concatenedDefinition, sourceDefinition);
        //     adoptPrivateProperties(concatenedDefinition, definition);
        // }

        return concatenedDefinition;
    }

    function populateDefinitionValue(definition, otherDefinition, referenceMap) {
        referenceMap.set(otherDefinition.value, definition);
        definition.value = otherDefinition.value;
        if (otherDefinition.hasOwnProperty('primitiveMark')) {
            definition.primitiveMark = true;
        } else if (otherDefinition.hasOwnProperty('propertiesGuard')) {
            definition.propertiesGuard = otherDefinition.propertiesGuard;
        }
    }

    function populateProperties(definition, otherDefinition, referenceMap) {
        definition.properties = otherDefinition.properties.map(function(property) {
            return importProperty(definition, property, referenceMap);
        });
    }

    function importProperty(definition, property, referenceMap) {
        // console.log('importing property', property.name, property);
        let CopyConstructor = property.constructor;
        let importedProperty = new CopyConstructor(definition);

        importedProperty.name = property.name;

        if (property.hasOwnProperty('valueDefinition')) {
            if (property.hasOwnProperty('writable')) {
                importedProperty.writable = property.writable;
            }
            if (property.hasOwnProperty('configurable')) {
                importedProperty.configurable = property.configurable;
            }
            if (property.hasOwnProperty('enumerable')) {
                importedProperty.enumerable = property.enumerable;
            }
            importedProperty.valueDefinition = importDefinition(definition, property.valueDefinition, referenceMap);
        } else {
            if (property.hasOwnProperty('configurable')) {
                importedProperty.configurable = property.configurable;
            }
            if (property.hasOwnProperty('enumerable')) {
                importedProperty.enumerable = property.enumerable;
            }

            if (property.hasOwnProperty('getDefinition')) {
                importedProperty.getDefinition = importDefinition(definition, property.getDefinition, referenceMap);
            }
            if (property.hasOwnProperty('setDefinition')) {
                importedProperty.setDefinition = importDefinition(definition, property.setDefinition, referenceMap);
            }
        }

        return importedProperty;
    }

    function importDefinition(definition, otherDefinition, referenceMap) {
        let otherDefinitionReference = otherDefinition.reference;
        if (otherDefinitionReference) {
            otherDefinition = otherDefinitionReference;
        }

        // console.log('copy the definition', definition.value);
        let importedDefinition = new otherDefinition.constructor(definition);
        let reference = referenceMap.get(otherDefinition.value);
        if (reference) {
            importedDefinition.markAsReferenceTo(reference);
        } else {
            populateDefinitionValue(importedDefinition, otherDefinition, referenceMap);
            if (otherDefinition.hasOwnProperty('properties')) {
                populateProperties(importedDefinition, otherDefinition, referenceMap);
            }
        }

        return importedDefinition;
    }

    function mergeDefinitionProperties(definition, otherDefinition, referenceMap) {
        // console.log(
        //     'merging properties',
        //     otherDefinition.getPropertyNames(),
        //     'into',
        //     definition.getPropertyNames()
        // );
        otherDefinition.properties.forEach(function(property) {
            mergeDefinitionProperty(definition, otherDefinition, property, referenceMap);
        });
    }

    function mergeDefinitionProperty(definition, otherDefinition, property, referenceMap) {
        let definitionProperty = definition.getProperty(property.name);
        let modifiedProperty;

        if (definitionProperty) {
            mergeProperty(definitionProperty, property, referenceMap);
            modifiedProperty = definitionProperty;
        } else {
            // console.log(
            //     'merge add the property',
            //     property.name, ':', property.valueDefinition.value,
            //     'to', definition.getPropertyNames()
            // );
            let newProperty = importProperty(definition, property, referenceMap);
            definition.properties.push(newProperty);
            // console.log('now definition properties are', definition.getPropertyNames());
            modifiedProperty = newProperty;
        }

        return modifiedProperty;
    }

    function mergeProperty(property, otherProperty, referenceMap) {
        if (otherProperty.hasOwnProperty('valueDefinition')) {
            if (property.hasOwnProperty('valueDefinition')) {
                // both property have valueDefinition
                property.writable = otherProperty.writable;
                property.enumerable = otherProperty.enumerable;
                property.configurable = otherProperty.configurable;
                mergeDefinition(property.valueDefinition, otherProperty.valueDefinition, referenceMap);
            } else {
                property.writable = otherProperty.writable;
                property.enumerable = otherProperty.enumerable;
                property.configurable = otherProperty.configurable;

                // self is getter/setter, merged is classic
                if (property.hasOwnProperty('setDefinition')) {
                    markAsUnreachable(property.setDefinition, referenceMap);
                    delete property.setDefinition;
                }
                if (property.hasOwnProperty('getDefinition')) {
                    markAsUnreachable(property.getDefinition, referenceMap);
                    delete property.getDefinition;
                }
                property.valueDefinition = importDefinition(
                    property.definition,
                    otherProperty.valueDefinition,
                    referenceMap
                );
            }
        } else {
            // we should merge enumerable, configurable but also other own property set on mergedProperty
            property.enumerable = otherProperty.enumerable;
            property.configurable = otherProperty.configurable;

            if (property.hasOwnProperty('valueDefinition')) {
                delete property.writable;
                markAsUnreachable(property.valueDefinition, referenceMap);
                delete property.valueDefinition;
            } else {
                if (otherProperty.hasOwnProperty('getDefinition')) {
                    if (property.hasOwnProperty('getDefinition')) {
                        mergeDefinition(property.getDefinition, otherProperty.getDefinition, referenceMap);
                    } else {
                        property.getDefinition = importDefinition(
                            property.definition,
                            otherProperty.getDefinition,
                            referenceMap
                            );
                    }
                }
                if (otherProperty.hasOwnProperty('setDefinition')) {
                    if (property.hasOwnProperty('setDefinition')) {
                        mergeDefinition(property.setDefinition, otherProperty.setDefinition, referenceMap);
                    } else {
                        property.setDefinition = importDefinition(
                            property.definition,
                            otherProperty.setDefinition,
                            referenceMap
                        );
                    }
                }
            }
        }
    }

    function mergeDefinition(definition, otherDefinition, referenceMap) {
        let otherDefinitionReference = otherDefinition.reference;
        if (otherDefinitionReference) {
            otherDefinition = otherDefinitionReference;
        }

        let reference = referenceMap.get(otherDefinition.value);
        if (reference) {
            // mark definition.value as unreachable
            markAsUnreachable(definition, referenceMap);
            // delete all except parent
            Object.keys(definition).forEach(function(key) {
                if (key !== 'parent') {
                    delete definition[key];
                }
            });
            definition.markAsReferenceTo(reference);
        } else {
            // console.log('value definition update to', otherDefinition.value, 'from', definition.value);
            markAsUnreachable(definition, referenceMap);
            delete definition.value;
            delete definition.primitiveMark;
            delete definition.propertiesGuard;
            populateDefinitionValue(definition, otherDefinition, referenceMap);
            if (otherDefinition.hasOwnProperty('properties')) {
                mergeDefinitionProperties(definition, otherDefinition, referenceMap);
            } else {
                delete definition.properties;
            }
        }
    }

    function markAsUnreachable(definition, referenceMap) {
        let reference = definition.reference;

        if (reference) {
            // console.log('a reference to', reference.value, 'marked as unreachable');
            // je suis une référence je dois disparaitre
            reference.removeReference(definition);
        } else {
            // console.log(definition.value, 'marked as unreachable');

            let mappedReference = referenceMap.get(definition.value);
            if (mappedReference === definition) {
                referenceMap.delete(definition.value); // only IF we are the reference to this value
            }

            // je dois aussi marquer tous mes enfants comme unreachable ettttt oui
            definition.properties.forEach(function(property) {
                if (property.hasOwnProperty('valueDefinition')) {
                    markAsUnreachable(property.valueDefinition, referenceMap);
                } else {
                    if (property.hasOwnProperty('getDefinition')) {
                        markAsUnreachable(property.getDefinition, referenceMap);
                    }
                    if (property.hasOwnProperty('setDefinition')) {
                        markAsUnreachable(property.setDefinition, referenceMap);
                    }
                }
            });
            // definition.privateProperties.forEach(function(privateProperty) {
            //     markAsUnreachable(privateProperty, referenceMap);
            // });
        }
    }

    return concatDefinition;
})();
Definition.prototype.concat = function(definition) {
    return concatDefinition(this, definition);
};
// we are missing the ability to merge only the property of two definition
// concat is great but the ability to merge an existing definition with an other definition properties
// would be cool
// (the ability to merge a definition with an other definition (aka not only the properties) is not that great so won't be available)

export default Definition;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        // to be tested
        // - setter/getter may be referenced and must have their own definition
        // merging of property with getter/setter/value
        // privateProperties

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

            // this.add('Map private properties', function() {
            //     let map = new Map();
            //     map.foo = false;
            //     map.set('foo', true);

            //     let definition = Definition.from(map);
            //     let fooProperty = definition.getProperty('foo');
            //     let fooPrivateProperty = definition.getPrivateProperty('foo');

            //     assert(fooProperty.valueDefinition.value === map.foo);
            //     assert(fooPrivateProperty.valueDefinition.value === map.get('foo'));
            // });
        });

        this.add('basic concat', function() {
            let a = {
                name: 'dam'
            };
            let b = {
                name: 'seb',
                age: 10
            };
            let aDefinition = Definition.from(a);
            let bDefinition = Definition.from(b);
            let cDefinition = aDefinition.concat(bDefinition);
            assert(cDefinition.getPropertyNames().join() === 'name,age');
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
