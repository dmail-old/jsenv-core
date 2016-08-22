/*
- enable reference logic (prevent circular structure & perf boost when value is the same, disabled for primitive)
- allow array concatenation
- allow an option called functionCloningStrategy : 'primitive', 'bind', 'wrap', 'eval' defaulting to primitive
it means valueGenerator will not copy the function and use the original one making it useless to list function properties
but functionCloningStrategy will be an option of valueGenerator not of ValueDefinition
one possible solution could be that something above valueGenerator knows valueGenerator will consider function as primitive
and thus will pass a valueDefinition to valueGenerator faking that function are primitive
when defined to 'bind' function are bound to their parent valueDefinition
the main cost becomes perf, stacktrace (not sure about stacktrace issue) and function.toString would print [native code]
- when properties of function are defined, we should not try to make the 'prototype' property immutable we can safely set it
on the created function, name is now configurable so it can be copied

- add an option called objectCloningStrategy: 'create', 'extend', defaulting to create
extend would do Object.create(valueDefinition.value) while create does Object.create(Object.getPrototypeOf(valueDefinition.value));
that extend would be used to inherit from model instead of beign completely deteched from it
- allow a custom getPropertyNames() when constructing a valueDefinition so that we only get a subset of the property definitions
- proto must use valueGenerator and we must obtain the desired result : immutable object on extend() & create()
*/

import util from './util.js';

var listKeys = (function() {
    function getAllEnumerableKeys(object) {
        return Object.getOwnPropertyNames(object);
    }

    function getAllKeysAndSymbols(object) {
        return Object.getOwnPropertyNames(object).concat(Object.getOwnPropertySymbols(object));
    }

    var getAllKeys = Object.getOwnPropertySymbols ? getAllKeysAndSymbols : getAllEnumerableKeys;

    return getAllKeys;
})();

var getPropertyNames = function(value, option = 'auto') {
    var propertyNames;

    if (util.isPrimitive(value)) {
        propertyNames = [];
    } else if (option === 'auto') {
        propertyNames = listKeys(value);
    } else if (util.isArray(option)) {
        propertyNames = option.filter(function(propertyName) {
            return Object.prototype.hasOwnProperty.call(value, propertyName);
        });
    }

    return propertyNames;
};

var PropertyDefinition = util.createConstructor({
    constructor(name, descriptor, valueDefinition) {
        this.name = name;
        this.descriptor = descriptor;
        this.valueDefinition = valueDefinition;
    },

    merge(propertyDefinition) {
        var descriptor = propertyDefinition.descriptor;
        if (descriptor === null) {
            // the property does not exists : tow solution, this property could become non existent as well
            // or we could ignore, for now ignore
        } else {
            this.name = propertyDefinition.name;

            var selfDescriptor = this.descriptor;
            // var selfValueDefinition = this.valueDefinition;
            var valueDefinition = propertyDefinition.valueDefinition;

            if ('value' in descriptor) {
                if (selfDescriptor === null) {
                    this.descriptor = descriptor;
                } else if ('value' in selfDescriptor) {
                    // both property are classic with value
                    selfDescriptor.writable = descriptor.writable;
                    selfDescriptor.writable = descriptor.writable;
                    selfDescriptor.enumerable = descriptor.enumerable;
                    selfDescriptor.configurable = descriptor.configurable;
                    selfDescriptor.value = descriptor.value;
                } else {
                    // self is getter/setter, merged is classic
                    delete selfDescriptor.set;
                    delete selfDescriptor.get;
                    selfDescriptor.writable = descriptor.writable;
                    selfDescriptor.enumerable = descriptor.enumerable;
                    selfDescriptor.configurable = descriptor.configurable;
                    selfDescriptor.value = descriptor.value;
                }
            } else if (selfDescriptor === null) {
                // this property does not exist
                this.descriptor = descriptor;
            } else if ('value' in selfDescriptor) {
                // this property is a classic one
                delete selfDescriptor.value;
                delete selfDescriptor.writable;
                selfDescriptor.enumerable = descriptor.enumerable;
                selfDescriptor.configurable = descriptor.configurable;
                selfDescriptor.get = descriptor.get;
                selfDescriptor.set = descriptor.set;
            } else {
                // both property are getter/setter
                selfDescriptor.enumerable = descriptor.enumerable;
                selfDescriptor.configurable = descriptor.configurable;
                var getter = descriptor.get;
                if (getter) {
                    selfDescriptor.get = getter;
                }
                var setter = descriptor.set;
                if (setter) {
                    selfDescriptor.set = setter;
                }
            }

            this.valueDefinition.merge(valueDefinition);
        }
    },

    clone(parent) {
        var cloneName = this.name;
        var cloneDescriptor = {};
        var cloneValueDefinition = this.valueDefinition.clone(parent);

        Object.keys(this.descriptor).forEach(function(key) {
            cloneDescriptor[key] = this.descriptor[key];
        }, this);

        var clonedPropertyDefinition = new this.constructor(
            cloneName,
            cloneDescriptor,
            cloneValueDefinition
        );

        return clonedPropertyDefinition;
    }
});

var getDeepestNodeOrSelf = function(node) {
    var deepestNode = node;

    while (true) { // eslint-disable-line
        var children = deepestNode.propertyDefinitions;

        if (children) {
            var childrenLength = children.length;

            if (childrenLength > 0) {
                var lastChild = children[childrenLength - 1].valueDefinition;
                deepestNode = lastChild;
                continue;
            }
        }
        break;
    }

    return deepestNode;
};

var ValueDefinition = util.createConstructor({
    valueMark: false,
    value: undefined,
    referenceMark: false,
    reference: null,
    references: [],
    // invalidReferences: [],
    // validReferences: [],
    primitiveMark: false,
    prototype: null,
    frozenMark: false, // true means cannot add & remove new property, existing property becomes unconfigurable & unwritable
    sealedMark: false, // true means cannot add & remove new property, existing property becomes unconfigurable
    extensibleMark: true, // false means cannot add new property
    propertyDefinitions: [],
    parent: null,
    get property() {
        if (this.parent) {
            return this.parent.propertyDefinitions.find(function(propertyDefinition) {
                return propertyDefinition.valueDefinition === this;
            }, this);
        }
        return null;
    },
    get propertyName() {
        var property = this.property;
        return property ? property.name : undefined;
    },

    constructor(parent) {
        if (parent) {
            // make parent property non enumerable so that it's not reseted/deleted on merge()
            Object.defineProperty(this, 'parent', {
                writable: true,
                configurable: true,
                enumerable: false,
                value: parent
            });
        }
    },

    addReference(reference) {
        if (!this.hasOwnProperty('references')) {
            Object.defineProperty(this, 'references', {
                writable: true,
                configurable: true,
                enumerable: false,
                value: []
            });
        }
        this.references.push(reference);
    },

    createPreviousNodeIterator() {
        var node = this;

        return {
            [Symbol.iterator]: function() {
                return this;
            },

            next() {
                var parent = node.parent;

                // we can do this early but that's not mandatory
                // we must check for value existence from this.previousSibling when existing
                // else from parent deepest propertyDefinition
                // else from parent

                if (parent) {
                    var children = parent.propertyDefinitions;
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
                        node = getDeepestNodeOrSelf(previousSibling.valueDefinition);
                    }
                } else {
                    node = undefined;
                }

                var result = {
                    done: !node,
                    value: node
                };

                return result;
            }
        };
    },

    populate(value) {
        // is value something we have seen before ?
        let existingDefinition = this.findReference(value);
        if (existingDefinition) {
            // console.log('reference to value', this.value, 'at property', this.propertyName);
            this.referenceMark = true;
            this.reference = existingDefinition;
            existingDefinition.addReference(this);
        } else {
            this.valueMark = true;
            this.value = value;

            // harcoding typeof value === 'function' to primitive but that's ugly
            // you may want to know if a function object isSealed and list its properties
            // they must be considered primitive only when the definition is used for a generator
            // and that the generator handle function as primitive
            if (util.isPrimitive(value) || typeof value === 'function') {
                this.primitiveMark = true;
            } else {
                // when value is not a primitive analyze its prototype, attributes & properties
                this.populatePrototype();
                this.populateAttributes();
                this.populateProperties();
            }
        }
        return this;
    },

    findReference(value) {
        let reference;
        for (let previousValueDefinition of this.createPreviousNodeIterator()) {
            if (previousValueDefinition.value === value) {
                reference = previousValueDefinition;
                break;
            }
        }
        return reference;
    },

    populatePrototype() {
        let value = this.value;

        if (util.speciesSymbol in value) {
            this.prototype = value[util.speciesSymbol].prototype;
        } else {
            this.prototype = Object.getPrototypeOf(value);
        }
    },

    populateAttributes() {
        let value = this.value;

        if (Object.isFrozen(value)) {
            this.frozenMark = true;
        } else if (Object.isSealed(value)) {
            this.sealedMark = true;
        } else if (Object.isExtensible(value) === false) {
            this.extensibleMark = false;
        }
    },

    populateProperties() {
        let value = this.value;
        let propertyNames = getPropertyNames(value);

        this.propertyDefinitions = [];

        propertyNames.forEach(function(propertyName) {
            var propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
            var propertyValueDefinition = new this.constructor(this);

            var propertyDefinition = new PropertyDefinition(
                propertyName,
                propertyDescriptor,
                propertyValueDefinition
            );

            // we always create a valueDefinition even if it's to say this valueDefinition does not exists
            if (propertyDescriptor === null) {
                // the property does not exists
                // propertyValueDefinition.existsMark = false
            } else if ('value' in propertyDescriptor) {
                var propertyValue = propertyDescriptor.value;
                propertyValueDefinition.populate(propertyValue);
            } else {
                // property has no valueDefinition, it does have a getter and or setter
            }

            this.propertyDefinitions.push(propertyDefinition);
        }, this);
    },

    getPropertyDefinition(propertyName) {
        return this.propertyDefinitions.find(function(propertyDefinition) {
            return propertyDefinition.name === propertyName;
        });
    },

    getPropertyValueDefinition(propertyName) {
        let propertyDefinition = this.getPropertyDefinition(propertyName);
        return propertyDefinition.valueDefinition;
    },

    branch(parent = undefined) {
        let branch = new this.constructor(parent);
        return branch;
    },

    mergePropertyDefinition(propertyDefinition) {
        // Considering :
        // A is a value definition
        // B is a value definition
        // C is the contenation of A & B
        // Then :
        // - references in A properties are always references of an A property in C properties
        // - definitions in A properties are always definitions of an A property in C properties
        // - references in B properties can
        //         - become reference of an A property
        //         - remain reference of a B property
        // - definitions in B properties can
        //         - become reference of an A property
        //         - remain a definition of a B properties

        // considering the above informations there is stuff todo :
        // when doing propertyDefinition.clone(), propertyDefinition may have lost is reference
        // and may become a reference

        let selfPropertyDefinitions = this.propertyDefinitions;
        let existingSelfPropertyDefinition = selfPropertyDefinitions.find(function(selfPropertyDefinition) {
            return selfPropertyDefinition.name === propertyDefinition.name;
        });

        if (existingSelfPropertyDefinition) {
            existingSelfPropertyDefinition.merge(propertyDefinition);
        } else {
            selfPropertyDefinitions.push(propertyDefinition.clone(this));
        }
    },

    toJSON() {
        var json = {};
        Object.keys(this).forEach(function(key) {
            json[key] = this[key];
        }, this);
        return json;
    },

    reset(properties) {
        let ownKeys = Object.keys(this);
        ownKeys.forEach(function(ownKey) {
            if (ownKey in properties === false) {
                delete this[ownKey];
            }
        }, this);
        let propertyKeys = Object.keys(properties);
        propertyKeys.forEach(function(propertyKey) {
            this[propertyKey] = properties[propertyKey];
        }, this);
    },

    merge(valueDefinition) {
        // let invalidReferenceIndex = this.invalidReferences.indexOf(referencedValueDefinition);

        // if (invalidReferenceIndex === -1) {
        //     valueDefinition = referencedValueDefinition;
        // } else if (invalidReferenceIndex in this.validReferences) {
        //     valueDefinition = this.validReferences[invalidReferenceIndex];
        // } else {
        //     // the reference becomes valid once it's cloned not here!
        //     // because valudeDefinition is not mutated so does not becomes valid
        //     this.validReferences[invalidReferenceIndex] = valueDefinition;
        // }

        // if (valueDefinition.references.length) {
        //     // fix this, it's does not work creating an infinite loop
        //     var i = 0;
        //     var references = valueDefinition.references;
        //     var firstReference = references[i++];
        //     if (firstReference) {
        //         firstReference.merge(valueDefinition);
        //     }
        //     var j = references.length;
        //     for (;i < j; i++) {
        //         references[i].reference = firstReference;
        //     }
        // }

        if (this.referenceMark) {
            this.reference.merge(valueDefinition);
        } else {
            let properties;
            let reference;
            if (valueDefinition.referenceMark) {
                // search the new reference
                reference = this.findReference(valueDefinition.reference.value);
                // if there is no reference in the new tree, use referenced definition as merged definition
                // however it does infinite loop for now because it will remerge the valueDefinition
                // remerging its properties for ever
                if (!reference) {
                    valueDefinition = valueDefinition.reference;
                    // I could do seomthing like saying this valueDefinition ha slost his reference but if we find it again
                    // in the properties we don't try to merge the known properties
                }
            } else {
                reference = this.findReference(valueDefinition.value);
            }

            if (reference) {
                // if this have references update them, we could also transfer this responsability to reference themselves
                // by replacing the above if (valueDefinition.referenceMark) {
                // with a while
                this.references.forEach(function(currentReference) {
                    currentReference.reference = reference;
                    reference.addReference(currentReference);
                });
                delete this.references; // we cannot have references anymore (anyway it's deleted by reset)
                reference.addReference(this);
                properties = {
                    referenceMark: true,
                    reference: reference
                };
                this.reset(properties);
            } else if (valueDefinition.valueMark) {
                if (this.primitiveMark) {
                    properties = valueDefinition.toJSON();
                    properties.propertyDefinitions = [];
                    this.reset(properties);
                    valueDefinition.propertyDefinitions.forEach(function(propertyDefinition) {
                        this.propertyDefinitions.push(propertyDefinition.clone(this));
                    }, this);
                } else if (valueDefinition.primitiveMark) {
                    // doit-on invalider this.references ? je pense que oui, à tester
                    properties = valueDefinition.toJSON();
                    this.reset(properties);
                } else {
                    // here we could add a check like and if none of this match
                    // we merge the value not the properties because
                    // prototype are not compatible, but to me all non primitive are compatible
                    // if (
                    //     valueDefinition.prototype === this.prototype ||
                    //     valueDefinition.prototype instanceof this.prototype ||
                    //     valueDefinition.isPrototypeOf(this.prototype)
                    // )
                    // valueDefinition.referenceInvalidedMark = true;
                    valueDefinition.propertyDefinitions.forEach(function(propertyDefinition) {
                        this.mergePropertyDefinition(propertyDefinition);
                    }, this);
                    // delete valueDefinition.referenceInvalidedMark;
                }
            } else {
                properties = valueDefinition.toJSON();
                this.reset(properties);
            }
        }

        return this;
    },

    clone(parent) {
        var clonedDefinition = this.branch(parent);
        let keys = Object.keys(this);

        // how do we handle references in the graph?
        // a new graph is imposed by the parent argument
        // we must check if parent == this.parent
        // when true, we are sure that references are still valid and we just have to make this.reference point to the new node
        // when false any references may have been lost because was available in the ancestor
        // and in that case we must make the first reference the new owner of the definition, and later reference point to this new owner
        keys.forEach(function(key) {
            let value = this[key];
            if (util.isArray(value)) {
                clonedDefinition[key] = value.map(function(entry) {
                    if (entry instanceof ValueDefinition) {
                        return entry.clone(clonedDefinition);
                    }
                    return entry;
                });
            } else {
                clonedDefinition[key] = value;
            }
        }, this);

        return clonedDefinition;
    },

    concat(valueDefinition) {
        let selfClone = this.clone();
        return selfClone.merge(valueDefinition);
    }
});

/* eslint-disable accessor-pairs */
export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function createDefinition(value) {
            var valueDefinition = new ValueDefinition().populate(value);

            var length = arguments.length;
            if (length > 1) {
                var i = 1;
                var j = length;

                for (;i < j; i++) {
                    valueDefinition.merge(createDefinition(arguments[i]));
                }
            }

            return valueDefinition;
        }

        // function concatValueDefinition(...args) {
        //     var concatenedDefinition = createDefinition(args[0]);
        //     args.slice(1).forEach(function(arg) {
        //         concatenedDefinition = concatenedDefinition.concat(createDefinition(arg));
        //     });
        //     return concatenedDefinition;
        // }

        var analyze = createDefinition;

        this.add('previousNodeIterator', function() {
            var a = {
                name: 'ok',
                item: {
                    foo: true,
                    bar: false
                },
                user: {
                    name: 'dam'
                }
            };
            var definition = analyze(a);
            var userDefinition = definition.getPropertyValueDefinition('user');
            var userNameDefinition = userDefinition.getPropertyValueDefinition('name');

            var previousNodeIterator = userNameDefinition.createPreviousNodeIterator();
            var previousNode;

            previousNode = previousNodeIterator.next().value;
            assert(previousNode.value === a.user);
            previousNode = previousNodeIterator.next().value;
            assert(previousNode.value === false);
            previousNode = previousNodeIterator.next().value;
            assert(previousNode.value === true);
            previousNode = previousNodeIterator.next().value;
            assert(previousNode.value === a.item);
            previousNode = previousNodeIterator.next().value;
            assert(previousNode.value === 'ok');
            previousNode = previousNodeIterator.next().value;
            assert(previousNode.value === a);
            previousNode = previousNodeIterator.next().value;
            assert(previousNode === undefined);
        });

        this.add('merge object', function() {
            // maybe the rootDefinition must not be overidden by a primitive
            // only property should be, for now even root definition are overidden
            var definition = analyze(
                {
                    foo: true
                },
                true
            );
            assert(definition.value === true);
            assert(definition.propertyDefinitions.length === 0);

            definition.merge(analyze(
                {
                    bar: true
                }
            ));
            assert(definition.propertyDefinitions.length === 1); // remains only the bar definition

            definition.merge(analyze(
                {
                    boo: true
                }
            ));
            assert(definition.value.bar === true);
            assert(definition.propertyDefinitions.length === 2);
            assert(definition.propertyDefinitions[0].name === 'bar');
            assert(definition.propertyDefinitions[1].name === 'boo');
        });

        this.add('merge property with one or two setter/getter', function() {
            var definition = analyze(
                {
                    name: 'ok'
                }
            );
            var nameDefinition = definition.propertyDefinitions[0];
            assert(nameDefinition.name === 'name');

            nameDefinition.merge(analyze(
                {
                    get name() {}
                }
            ).getPropertyDefinition('name'));
            // the propertyDefinition must now be a setter/getter
            assert('value' in nameDefinition.descriptor === false);
            assert(nameDefinition.valueDefinition.valueMark === false);
            assert(typeof nameDefinition.descriptor.get === 'function');

            nameDefinition.merge(analyze(
                {
                    set name(value) {}
                }
            ).getPropertyDefinition('name'));
            // propertyDefinition setter & getter must be available
            assert(typeof nameDefinition.descriptor.set === 'function');
            assert(typeof nameDefinition.descriptor.get === 'function');

            nameDefinition.merge(analyze(
                {
                    name: 'dam'
                }
            ).getPropertyDefinition('name'));
            assert(nameDefinition.descriptor.value === 'dam');
        });

        this.add('merge property with unexistent property', function() {
            // currently the API does not let you do this
            // but you may potentially analyze a subset of value properties
            // if a property does not exists in the value it still creates propertyDefinition with descriptor to null
            // we may just filter them out as well but it's better to keep the intent and decide later
            // what to do with non existent property
        }).skip('todo');

        this.add('basic reference', function() {
            var a = {};
            a.self = a;
            var definition = analyze(
                a
            );
            var selfValueDefinition = definition.getPropertyValueDefinition('self');
            assert(selfValueDefinition.reference === definition);
            assert(definition.references[0] === selfValueDefinition);
            assert(definition.references.length === 1);

            let clonedDefinition = definition.clone();
            selfValueDefinition = clonedDefinition.getPropertyValueDefinition('self');
            console.log(selfValueDefinition);
            assert(selfValueDefinition.reference === clonedDefinition);
            assert(clonedDefinition.references[0] === selfValueDefinition);
            assert(clonedDefinition.references.length === 1);
        });

        /*
        this.add('merge with self reference', function() {
            var a = {};
            var b = {};
            a.self = a;
            var definition = analyze(
                a,
                b
            );

            var selfValueDefinition = definition.getPropertyValueDefinition('self');
            assert(selfValueDefinition.reference === definition);
            assert(definition.references[0] === selfValueDefinition);
            assert(definition.references.length === 1);
        });

        this.add('merge with merged reference', function() {
            // creates a infinite loop because the propertyDefinition refers to
            // b definition which will merge the property definition referencing again the b definition
            // I think the first thing to do is to invalidate the references when b disapear from it's property definitions
            // references
            var a = {};
            var b = {};
            b.self = b;
            var definition = analyze(
                a,
                b
            );
            var selfValueDefinition = definition.getPropertyValueDefinition('self');
            assert(selfValueDefinition.reference === null);
        });
        */

        /*
        more complex reference scenario to test :
        - a reference in B becomes a reference in A (must target a property)

        this.add('concat parent', function() {
            var a = {user: {name: 'dam'}};
            var b = {user: {age: 10}};
            var definition = analyze(a).concat(analyze(b));
            var userValueDefinition = definition.getPropertyValueDefinition('user');
            assert(userValueDefinition.parent === definition);

            var ageValueDefinition = userValueDefinition.getPropertyValueDefinition('age');
            assert(ageValueDefinition.parent === userValueDefinition);
        });

        this.add('findReference(value)', function() {
            var value = {
                foo: 'bar',
                user: {
                    name: 'dam'
                }
            };
            var definition = analyze(value);
            var reference = definition.findReference(value.user);

            // reference must be undefined because findReference check for previousnode reference
            assert(reference === undefined);
        });

        this.add('references', function() {
            var value = {
                foo: true
            };
            value.self = value;
            var definition = analyze(value);

            assert(definition.references.length === 1);
        });
        */

        /*
        this.add('definition references', function() {
            var a = [];
            a.push(a, 1, a);
            var definition = createDefinition(a);
            var firstEntryDefinition = definition.getPropertyDefinition('0').valueDefinition;
            var thirdEntryDefinition = definition.getPropertyDefinition('2').valueDefinition;

            assert(firstEntryDefinition.referenceMark);
            assert(firstEntryDefinition.reference === definition);
            assert(thirdEntryDefinition.referenceMark);
            assert(thirdEntryDefinition.reference === definition);

            assert(definition.references[0] === firstEntryDefinition);
            assert(definition.references[1] === thirdEntryDefinition);
        });

        this.add('concat references', function() {
            var a = {name: 'a'};
            var b = {name: 'b'};
            b.self = b;
            var aDefinition = scan(a);
            var bDefinition = scan(b);

            assert(bDefinition.getPropertyValueDefinition('self').reference === bDefinition);

            var cDefinition = aDefinition.concat(bDefinition);
            assert(cDefinition.parent === null);
            assert(cDefinition.getPropertyValueDefinition('self').referenceMark === false);
        });
        */

        // this.add('concatened definition references', function() {
        //     var a = {};
        //     var b = {};
        //     a.foo = a;
        //     a.bar = b;
        //     a.bat = a;
        //     b.boo = b;
        //     b.bor = a;
        //     b.bot = b;
        //     var aValueDefinition = createDefinition(a);
        //     var bValueDefinition = createDefinition(b);
        //     var definition = aValueDefinition.concat(bValueDefinition);

        //     var fooValueDefinition = definition.getPropertyDefinition('foo').valueDefinition;
        //     var barValueDefinition = definition.getPropertyDefinition('bar').valueDefinition;
        //     var batValueDefinition = definition.getPropertyDefinition('bat').valueDefinition;
        //     var booValueDefinition = definition.getPropertyDefinition('boo').valueDefinition;
        //     var borValueDefinition = definition.getPropertyDefinition('bor').valueDefinition;
        //     var botValueDefinition = definition.getPropertyDefinition('bot').valueDefinition;

        //     assert(fooValueDefinition.reference === definition);
        //     assert(barValueDefinition.reference === null); // because b was lost bar is the only one aware of b
        //     assert(batValueDefinition.reference === definition);
        //     assert(booValueDefinition.reference === barValueDefinition);
        //     assert(borValueDefinition.reference === definition);
        //     assert(botValueDefinition.reference === barValueDefinition);

        //     // IT WAS A THOUGH ONE, now the next test must do the same but mixing property because here we dont have two
        //     // property using reference, all property are unique
        //     // also try with reference nested because here we do not test
        //     // when the reference is nested just when it's in the same propertyDefinitions array level
        // });

        /*
        this.add('concatened definition nested reference', function() {
            var a = {};
            var b = {};

            a.foo = a;
            b.item = {
                boo: a,
                bat: b
            };

            var aValueDefinition = createDefinition(a);
            var bValueDefinition = createDefinition(b);
            var definition = aValueDefinition.concat(bValueDefinition);

            var fooValueDefinition = definition.getPropertyDefinition('foo').valueDefinition;
            // var barValueDefinition = definition.getPropertyDefinition('bar').valueDefinition;
            var itemValueDefinition = definition.getPropertyDefinition('item').valueDefinition;
            var booValueDefinition = itemValueDefinition.getPropertyDefinition('boo').valueDefinition;
            var batValueDefinition = itemValueDefinition.getPropertyDefinition('bat').valueDefinition;

            assert(fooValueDefinition.reference === definition);
            console.log(booValueDefinition.reference);
            assert(booValueDefinition.reference === definition);
            assert(batValueDefinition.reference === null);
        });
        */

        // this.add('concatened definition references', function() {
        //     var a = [];
        //     var b = [];
        //     a.push(a, b, a);
        //     b.push(b, a, b);
        //     var definition = concatValueDefinition(a, b);

        //     console.log(definition);
        // });

        // this.add('basic generation', function() {
        //     var value = {
        //         foo: {
        //             bar: true
        //         }
        //     };
        //     var definition = createDefinition(value);
        //     var generator = createGenerator(definition);
        //     var generated = generator.generate();

        //     assert(generated.foo.bar === true);
        //     assert(generated.foo !== value.foo); // generated object are unique
        // });

        // this.add('definition is aware of frozen/sealed/extensible', function() {
        //     var object = {};
        //     var frozenObject = Object.freeze({});
        //     var sealedObject = Object.seal({});
        //     var nonExtensibleObject = Object.preventExtensions({});

        //     var frozenDefinition = createDefinition(frozenObject);
        //     assert(frozenDefinition.frozenMark === true);
        //     assert(frozenDefinition.sealedMark === false);
        //     assert(frozenDefinition.extensibleMark === true);

        //     var sealedDefinition = createDefinition(sealedObject);
        //     assert(sealedDefinition.frozenMark === false);
        //     assert(sealedDefinition.sealedMark === true);
        //     assert(sealedDefinition.extensibleMark === true);

        //     var nonExtensibleDefinition = createDefinition(nonExtensibleObject);
        //     assert(nonExtensibleDefinition.frozenMark === false);
        //     assert(nonExtensibleDefinition.sealedMark === false);
        //     assert(nonExtensibleDefinition.extensibleMark === false);

        //     var objectDefinition = createDefinition(object);
        //     assert(objectDefinition.frozenMark === false);
        //     assert(objectDefinition.sealedMark === false);
        //     assert(objectDefinition.extensibleMark === true);
        // });

        // this.add('concatened generation ignore frozen/sealed/extensible of the concatened definition', function() {
        //     var object = {};
        //     var frozenObject = Object.freeze({});

        //     var objectDefinition = concatDefinition(object, frozenObject);
        //     assert(objectDefinition.frozenMark === false);
        //     assert(objectDefinition.sealedMark === false);
        //     assert(objectDefinition.extensibleMark === true);
        // });
    }
};
/* eslint-enable accessor-pairs */
