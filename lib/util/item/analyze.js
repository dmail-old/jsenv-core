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
    }
});

var speciesSymbol = typeof Symbol === 'undefined' ? '@@species' : Symbol.species;

var ValueDefinition = util.createConstructor({
    value: undefined,
    referenceMark: false,
    reference: null,
    references: [],
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

    constructor() {},

    createPreviousNodeIterator() {
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

        var node = this;

        return {
            [Symbol.iterator]: function() {
                return this;
            },

            next() {
                var parent = node.parent;

                if (parent) {
                    var children = parent.propertyDefinitions;
                    var index = children.findIndex(function(child) {
                        return child.valueDefinition === node;
                    });

                    if (index === -1) {
                        // throw new Error('unable to find node in parent children');
                        // node is not yet in it's parent propertyDefinitions so we consider the last child as previousSibling
                        // we hardoc this for now but it shoud throw because considering the last child as previousSibling
                        // is only true if we plan to push the node in children array
                        index = children.length - 1;
                        if (index === -1) {
                            index = 0;
                        }
                    }

                    if (index === 0) { // there is no previousSibling
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

    markAsReferenceTo(reference) {
        this.referenceMark = true;
        this.reference = reference;
        if (!reference.hasOwnProperty('references')) {
            reference.references = [];
        }
        reference.references.push(this);
    },

    populate(value) {
        this.value = value;
        // analyze if value is a reference to something we know
        this.populateReference();
        if (this.referenceMark === false) {
            // analyze if the value is primitive (a lot of stuff depends on this)
            this.populatePrimitivity();
            if (this.primitiveMark === false) {
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

    populateReference() {
        var existingDefinition = this.findReference(this.value);

        if (existingDefinition) {
            // console.log('reference to value', this.value, 'at property', this.propertyName);
            this.markAsReferenceTo(existingDefinition);
        }
    },

    populatePrimitivity() {
        let value = this.value;

        // harcoding typeof value === 'function' to primitive but that's ugly
        // you may want to know if a function object isSealed and list its properties
        // they must be considered primitive only when the definition is used for a generator
        // and that the generator handle function as primitive
        if (util.isPrimitive(value) || typeof value === 'function') {
            this.primitiveMark = true;
        }
    },

    populatePrototype() {
        let value = this.value;

        if (speciesSymbol in value) {
            this.prototype = value[speciesSymbol].prototype;
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
            var propertyValueDefinition = new this.constructor();
            propertyValueDefinition.parent = this;

            // we always create a valueDefinition even if it's to say this valueDefinition does not exists
            if (propertyDescriptor === null) {
                // the property does not exists
                // propertyValueDefinition.existsMark = false
            } else if ('value' in propertyDescriptor) {
                var propertyValue = propertyDescriptor.value;
                propertyValueDefinition.populate(propertyValue);
            } else {
                // property has no valueDefinition, it does have a getter and or setter
                // propertyValueDefinition.definedMark = false;
            }

            var propertyDefinition = new PropertyDefinition(
                propertyName,
                propertyDescriptor,
                propertyValueDefinition
            );
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
        return propertyDefinition ? propertyDefinition.valueDefinition : null;
    },

    clonePropertyDefinition(propertyDefinition) {
        var cloneName = propertyDefinition.name;
        var cloneDescriptor = propertyDefinition.descriptor;
        var propertyValueDefinition = propertyDefinition.valueDefinition;
        var cloneValueDefinition;

        cloneValueDefinition = propertyValueDefinition.branch();
        cloneValueDefinition.parent = this;
        cloneValueDefinition.populateWith(propertyValueDefinition);

        var clonedPropertyDefinition = new propertyDefinition.constructor(
            cloneName,
            cloneDescriptor,
            cloneValueDefinition
        );

        return clonedPropertyDefinition;
    },

    groupPropertyDefinitions() {
        var groups = [];
        var args = arguments;
        var i = 0;
        var j = args.length;
        for (; i < j; i++) {
            var propertyDefinitions = args[i];
            var propertyDefinitionIndex = 0;
            var propertyDefinitionsLength = propertyDefinitions.length;

            for (; propertyDefinitionIndex < propertyDefinitionsLength; propertyDefinitionIndex++) {
                var propertyDefinition = propertyDefinitions[propertyDefinitionIndex];

                var propertyName = propertyDefinition.name;
                var existingPropertyDefinitionGroup;
                if (i > 0) { // no group exist on first loop
                    existingPropertyDefinitionGroup = groups.find(function(group) { // eslint-disable-line
                        return group[0].name === propertyName;
                    });
                }

                var group;
                if (existingPropertyDefinitionGroup) {
                    group = existingPropertyDefinitionGroup;
                    group.push(propertyDefinition);
                } else {
                    group = [];
                    group.push(propertyDefinition);
                    groups.push(group);
                }
            }
        }

        return groups;
    },

    concatValueDefinition(firstValueDefinition, secondValueDefinition) {
        var concatenedValueDefinition;

        if (secondValueDefinition) {
            if (firstValueDefinition) {
                concatenedValueDefinition = firstValueDefinition.branch();
                concatenedValueDefinition.parent = this;
                concatenedValueDefinition.fillWith(firstValueDefinition, secondValueDefinition);
            } else {
                concatenedValueDefinition = secondValueDefinition.branch();
                concatenedValueDefinition.parent = this;
                concatenedValueDefinition.populateWith(secondValueDefinition);
            }
        } else {
            concatenedValueDefinition = undefined;
        }

        return concatenedValueDefinition;
    },

    concatDescriptor(firstDescriptor, secondDescriptor) {
        var concatenedDescriptor;
        if (secondDescriptor) {
            if ('value' in secondDescriptor) {
                concatenedDescriptor = secondDescriptor;
            } else {
                concatenedDescriptor = {};
                concatenedDescriptor.enumerable = secondDescriptor.enumerable;
                concatenedDescriptor.configurable = secondDescriptor.configurable;
                concatenedDescriptor.set = secondDescriptor.set || firstDescriptor.set;
                concatenedDescriptor.get = secondDescriptor.get || firstDescriptor.get;
            }
        } else {
            concatenedDescriptor = secondDescriptor;
        }
        return concatenedDescriptor;
    },

    concatPropertyDefinition(firstPropertyDefinition, secondPropertyDefinition) {
        var ConcatenedConstructor = firstPropertyDefinition.constructor;
        var concatenedName = secondPropertyDefinition.name;
        var concatenedDescriptor = this.concatDescriptor(
            firstPropertyDefinition.descriptor,
            secondPropertyDefinition.descriptor
        );
        var concatenedValueDefinition = this.concatValueDefinition(
            firstPropertyDefinition.valueDefinition,
            secondPropertyDefinition.valueDefinition
        );
        var concatenedPropertyDefinition = new ConcatenedConstructor(
            concatenedName,
            concatenedDescriptor,
            concatenedValueDefinition
        );

        return concatenedPropertyDefinition;
    },

    branch() {
        return new this.constructor();
    },

    adopt(valueDefinition) {
        this.value = valueDefinition.value;

        if (valueDefinition.primitiveMark) {
            this.primitiveMark = true;
        } else {
            this.prototype = valueDefinition.prototype;
            // we should write valueDefinition.frozenMark !== this.constructor.frozenMark but hey let's assume it does not change
            if (valueDefinition.frozenMark) {
                this.frozenMark = true;
            } else if (valueDefinition.sealedMark) {
                this.sealedMark = true;
            } else if (valueDefinition.extensibleMark === false) {
                this.extensibleMark = false;
            }
            // this.propertyDefinitions = valueDefinition.propertyDefinitions;
        }
    },

    fillWith(firstValueDefinition, secondValueDefinition) {
        if (firstValueDefinition.referenceMark) {
            firstValueDefinition = firstValueDefinition.reference;
        }
        if (secondValueDefinition.referenceMark) {
            secondValueDefinition = secondValueDefinition.reference;
        }

        if (firstValueDefinition.primitiveMark || secondValueDefinition.primitiveMark) {
            this.adopt(secondValueDefinition);
        } else {
            var reference = this.findReference(firstValueDefinition.value);
            if (reference) {
                this.markAsReferenceTo(reference);
            } else {
                this.adopt(firstValueDefinition);
                this.propertyDefinitions = [];

                var firstPropertyDefinitions = firstValueDefinition.propertyDefinitions;
                var secondPropertyDefinitions = secondValueDefinition.propertyDefinitions;
                var groups = this.groupPropertyDefinitions(
                    firstPropertyDefinitions,
                    secondPropertyDefinitions
                );
                var i = 0;
                var j = groups.length;
                // console.log('group repartition', groups.map(function(group) {
                //     return group[0].name + ':' + group.length;
                // }));

                for (;i < j; i++) {
                    var group = groups[i];
                    var groupLength = group.length;
                    var concatenedPropertyDefinition;

                    if (groupLength === 1) {
                        var propertyDefinition = group[0];
                        // console.log('cloning propertyDefinition', propertyDefinition.name);
                        concatenedPropertyDefinition = this.clonePropertyDefinition(
                            propertyDefinition
                        );
                    } else {
                        concatenedPropertyDefinition = this.concatPropertyDefinition(
                            group[0], group[1]
                        );
                    }

                    this.propertyDefinitions.push(concatenedPropertyDefinition);
                }
            }
        }
    },

    populateWith(valueDefinition) {
        if (valueDefinition.referenceMark) {
            valueDefinition = valueDefinition.reference;
        }

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

        let reference;
        if (valueDefinition.hasOwnProperty('value')) {
            reference = this.findReference(valueDefinition.value);
        }

        if (reference) {
            this.markAsReferenceTo(reference);
        } else {
            this.adopt(valueDefinition);
            this.propertyDefinitions = valueDefinition.propertyDefinitions.map(
                this.clonePropertyDefinition,
                this
            );
        }
    },

    merge() {
        // we'll use merge most of the time, not concat & concat will only be
        // this.clone().merge(valueDefinition)
        // merge is not immutable so better perf & you dont have to clone existing definition just to merge them
        // with the one passed in arguments
    },

    concat(valueDefinition) {
        var concatenedDefinition = this.branch();
        concatenedDefinition.fillWith(this, valueDefinition);
        return concatenedDefinition;
    },

    clone() {
        var clonedDefinition = this.branch();
        clonedDefinition.populateWith(this);
        return clonedDefinition;
    }
});

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function createDefinition(value) {
            return new ValueDefinition().populate(value);
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

        this.add('concatenation with left reference', function() {
            var a = {};
            var b = {};
            a.self = a;
            var definition = analyze(a).concat(analyze(b));

            assert(definition.getPropertyValueDefinition('self').reference === definition);
        });

        this.add('concatenation with rigtht reference', function() {
            var a = {name: 'dam'};
            var b = {age: 10};
            b.self = b;

            var definition = analyze(a).concat(analyze(b));

            assert(definition.getPropertyValueDefinition('self').reference === null);
        });

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
