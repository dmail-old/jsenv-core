import util from './util.js';

let Definition = util.createConstructor({
    constructor() {

    },

    match(value) {
        return this.Matcher.prototype.match(value);
    }
});

// match + analyze
let Matcher = util.createConstructor({
    match() {
        return false;
    }
});
Definition.prototype.Matcher = Matcher;

Object.assign(Definition.prototype, {
    analyze(value, parentAnalyzer) {
        let analyzer = new this.Analyzer(this, parentAnalyzer);
        analyzer.analyze(value);
    }
});
let Analyzer = util.createConstructor({
    constructor(definition, parentAnalyzer) {
        this.definition = definition;
        if (parentAnalyzer) {
            this.parentAnalyzer = parentAnalyzer;
            this.referenceMap = parentAnalyzer.referenceMap;
        } else {
            this.referenceMap = new util.ReferenceMap();
        }
    },

    analyze(value) {
        this.referenceMap.set(value, this.definition);
        this.definition.value = value;
        this.populate();
    },

    populate() {

    }
});
Definition.prototype.Analyzer = Analyzer;

let DefinitionDatabase = {
    create(value) {
        let MatchingDefinitionConstructor = this.match(value);
        let definition = new MatchingDefinitionConstructor();
        definition.analyze(value);
        return definition;
    },

    match(value) {
        if (arguments.length === 0) {
            throw new Error('DefinitionDatabase match expect one arguments');
        }
        let MatchingDefinitionConstructor = this.DefinitionConstructors.find(
            function(DefinitionConstructor) {
                return DefinitionConstructor.prototype.match(value);
            }
        );
        if (!MatchingDefinitionConstructor) {
            throw new Error('no registered definition matched value ' + value);
        }
        return MatchingDefinitionConstructor;
    },
    DefinitionConstructors: [],

    register(DefinitionConstructor) {
        this.DefinitionConstructors.push(DefinitionConstructor);
        return DefinitionConstructor;
    }
};

// primitive
let PrimitiveDefinition = (function() {
    let PrimitiveMatcher = util.extendConstructor(Matcher, {
        match(value) {
            return util.isPrimitive(value);
        }
    });
    let PrimitiveAnalyzer = util.extendConstructor(Analyzer, {
        populate() {
            this.definition.primitiveMark = true;
        }
    });
    let PrimitiveDefinition = util.extendConstructor(Definition, {
        Matcher: PrimitiveMatcher,
        Analyzer: PrimitiveAnalyzer
    });

    return PrimitiveDefinition;
})();
DefinitionDatabase.register(PrimitiveDefinition);

// when value analyzer may have propertiesGuard us this mixin
let propertiesGuardAnalyzerMixin = {
    populatePropertiesGuard() {
        let definition = this.definition;
        let value = definition.value;

        if (Object.isFrozen(value)) {
            definition.propertiesGuard = 'frozen';
        } else if (Object.isSealed(value)) {
            definition.propertiesGuard = 'sealed';
        } else if (Object.isExtensible(value) === false) {
            definition.propertiesGuard = 'non-extensible';
        }
    }
};
Object.assign(Definition.prototype, {
    propertiesGuard: 'none'
});

// when value analyzer have properties, use this mixin
let propertiesAnalyzerMixin = {
    populateProperties() {
        let properties = this.createProperties();
        if (properties) {
            this.definition.properties = properties;
        }
    },

    createProperties() {
        return this.listPropertyNames().map(function(name) {
            return this.createProperty(name);
        }, this);
    },

    listPropertyNames() {
        return Object.getOwnPropertyNames(this.definition.value);
    },

    createProperty(name) {
        let definition = this.definition;
        let property = new this.Property(definition);
        let propertyDescriptor = Object.getOwnPropertyDescriptor(definition.value, name);

        property.name = name;
        if ('value' in propertyDescriptor) {
            property.populateDescriptorAttribute(propertyDescriptor, 'writable');
            property.populateDescriptorAttribute(propertyDescriptor, 'configurable');
            property.populateDescriptorAttribute(propertyDescriptor, 'enumerable');

            property.valueDefinition = this.createNestedDefinition(propertyDescriptor.value);
        } else {
            property.populateDescriptorAttribute(propertyDescriptor, 'configurable');
            property.populateDescriptorAttribute(propertyDescriptor, 'enumerable');

            let setter = propertyDescriptor.set;
            if (setter) {
                property.setDefinition = this.createNestedDefinition(setter);
            }
            let getter = propertyDescriptor.get;
            if (getter) {
                property.getDefinition = this.createNestedDefinition(getter);
            }
        }

        return property;
    },

    createNestedDefinition(value) {
        let definition;
        let existingDefinition = this.referenceMap.get(value);

        if (existingDefinition) {
            definition = existingDefinition.createPointer();
        } else {
            // definition.analyzer.referenceMap must be this.referenceMap
            let DefinitionConstructor = DefinitionDatabase.match(value);
            definition = new DefinitionConstructor();
            definition.analyze(value, this);
        }

        return definition;
    }
};
let Property = util.createConstructor({
    constructor(definition) {
        this.definition = definition;
    },

    populateDescriptorAttribute(propertyDescriptor, name) {
        let value = propertyDescriptor[name];
        if (value !== this.constructor[name]) {
            this[name] = value;
        }
    }
});
propertiesAnalyzerMixin.Property = Property;
Object.assign(Definition.prototype, {
    createPointer() {
        let pointerDefinition = new this.constructor();
        pointerDefinition.pointer = this;
        let pointers;
        if (this.hasOwnProperty('pointers')) {
            pointers = this.pointers;
        } else {
            pointers = [];
            this.pointers = pointers;
        }
        pointers.push(pointerDefinition);
        return pointerDefinition;
    },
    pointers: [],
    pointer: null
});

/*
all the stuff about merge & concat must be more prepared because it's a bit more
complex than analyzer because when merging or concatenating
we must import property in the new definition or merge them
this choice introduce a new complexity
moreover, having to compute once more the referenceMap of the merged/concatened definition
is inneficient, we must keep that referenceMap (which may be renamed into valueMap)
this valueMap is stored on the rootDefinition, when merging we can use it to know where are the value
and using markAsUnreferenced handle the mutation of the definition
*/

// merge
Object.assign(Definition.prototype, {
    merge(definition, parentMerger) {
        let merger = new this.Merger(this, parentMerger);
        return merger.merge(definition);
    },

    mergeProperties() {

    },

    concat(definition) {
        let concatenedDefinition = new definition.constructor();

        concatenedDefinition.mergeProperties(this.definition);
        concatenedDefinition.merge(definition);

        return concatenedDefinition;
    }
});
let Merger = util.createConstructor({
    constructor(definition, parentMerger) {
        this.definition = definition;
        if (parentMerger) {
            this.parentMerger = parentMerger;
            this.referenceMap = parentMerger.referenceMap;
        } else {
            this.referenceMap = new util.ReferenceMap();
        }
    },

    merge(otherDefinition) {
        // shouldn't we ensure that otherDefinition is external to definition ?
        // shouldn't we throw when they are reference ?
        let otherDefinitionPointer = otherDefinition.reference;
        if (otherDefinitionPointer) {
            otherDefinition = otherDefinitionPointer;
        }
        this.otherDefinition = otherDefinition;

        this.referenceMap.set(otherDefinition.value, this.definition);
        this.definition.value = otherDefinition.value;
        this.populate(otherDefinition);

        return this.definition;
    },

    populate() {

    }
});
Definition.prototype.Merger = Merger;
let propertiesGuardMergerMixin = {
    populatePropertiesGuard() {
        if (this.otherDefinition.hasOwnProperty('propertiesGuard')) {
            this.concatenedDefinition.propertiesGuard = this.otherDefinition.propertiesGuard;
        }
    }
};
// il manque le concept de merge, on en a besoin dans importDefinition, à voir
let propertiesMergerMixin = {
    populateProperties() {
        if (this.otherDefinition.hasOwnProperty('properties')) {
            if (this.definition.hasOwnProperty('properties')) {
                this.importProperties(definition);
                this.addProperties(otherDefinition);
            } else {
                this.importProperties(otherDefinition);
            }
        }
    },

    importProperties(definition) {
        this.concatenedDefinition.properties = [];
        // à ne faire que si concatened a des propriétés bien sûr
        definition.properties.forEach(function(property) {
            this.importProperty(property);
        }, this);
    },

    importProperty(property) {
        // console.log('importing property', property.name, property);
        let CopyConstructor = property.constructor;
        let importedProperty = new CopyConstructor(this.concatenedDefinition);

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
            importedProperty.valueDefinition = this.importDefinition(property.valueDefinition);
        } else {
            if (property.hasOwnProperty('configurable')) {
                importedProperty.configurable = property.configurable;
            }
            if (property.hasOwnProperty('enumerable')) {
                importedProperty.enumerable = property.enumerable;
            }

            if (property.hasOwnProperty('getDefinition')) {
                importedProperty.getDefinition = this.importDefinition(property.getDefinition);
            }
            if (property.hasOwnProperty('setDefinition')) {
                importedProperty.setDefinition = this.importDefinition(property.setDefinition);
            }
        }

        concatenedDefinition.properties.push(importedProperty);

        return importedProperty;
    },

    importDefinition(definition) {
        let definitionPointer = definition.pointer;
        if (definitionPointer) {
            definition = definitionPointer;
        }

        // console.log('copy the definition', definition.value);
        let importedDefinition;
        let reference = referenceMap.get(definition.value);
        if (reference) {
            importedDefinition = reference.createPointer();
        } else {
            let ImportedDefinitionConstructor = definition.constructor;
            importedDefinition = new ImportedDefinitionConstructor(this.concatenedDefinition);
            importedDefinition.merge(definition, this);
        }

        return importedDefinition;
    },

    addProperties(definition) {
        // console.log(
        //     'merging properties',
        //     otherDefinition.getPropertyNames(),
        //     'into',
        //     definition.getPropertyNames()
        // );
        definition.properties.forEach(function(property) {
            this.addProperty(property, definition);
        }, this);
    },

    addProperty(property, definition) {
        let existingProperty = this.concatenedDefinition.getProperty(property.name);
        let modifiedProperty;

        if (existingProperty) {
            this.mergeProperty(existingProperty, property);
            modifiedProperty = existingProperty;
        } else {
            // console.log(
            //     'merge add the property',
            //     property.name, ':', property.valueDefinition.value,
            //     'to', definition.getPropertyNames()
            // );
            let newProperty = this.importProperty(property);
            // console.log('now definition properties are', definition.getPropertyNames());
            modifiedProperty = newProperty;
        }

        return modifiedProperty;
    },

    mergeProperty(property, otherProperty) {
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
    },

    mergeDefinition(definition, otherDefinition) {
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
    },

    markAsUnreachable(definition) {
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
};

// array
let ArrayDefinition = (function() {
    let ArrayMatcher = util.extendConstructor(Matcher, {
        match(value) {
            return Array.isArray(value);
        }
    });

    // on pourrait faire un truc comme ça
    // mais j'aime pas du tout parce qu'on est emmerdé
    // je préfèrerais un truc qui utilise la composition genre
    // ValueWithPropertiesAnalyzerProperties
    let ArrayAnalyzer = util.extendConstructor(Analyzer, {
        populate() {
            // to avoid this we could consider that when a mixin
            // redefine a function already existing it means call both of them
            // for now let's ignore
            this.populatePropertiesGuard();
            this.populateProperties();
        }
    }, propertiesAnalyzerMixin, propertiesGuardAnalyzerMixin, {
        listPropertyNames() {
            return this.definition.value.map(function(value, index) {
                return String(index);
            });
        }
    });

    let ArrayMerger = util.extendConstructor(Merger, {
        populate() {
            this.populatePropertiesGuard();
            this.populateProperties();
        }
    }, propertiesMergerMixin, propertiesGuardMergerMixin);

    let ArrayDefinition = util.extendConstructor(Definition, {
        Matcher: ArrayMatcher,
        Analyzer: ArrayAnalyzer,
        Merger: ArrayMerger
    });

    return ArrayDefinition;
})();
DefinitionDatabase.register(ArrayDefinition);

// object
let ObjectDefinition = (function() {
    let ObjectMatcher = util.extendConstructor(Matcher, {
        match(value) {
            return util.isPrimitive(value) === false;
        }
    });

    let ObjectAnalyzer = util.extendConstructor(Analyzer, {
        populate() {
            this.populatePropertiesGuard();
            this.populateProperties();
        }
    }, propertiesAnalyzerMixin, propertiesGuardAnalyzerMixin);

    let ObjectMerger = util.extendConstructor(Merger, {
        populate() {
            this.populatePropertiesGuard();
            this.populateProperties();
        }
    }, propertiesMergerMixin, propertiesGuardMergerMixin);

    let ObjectDefinition = util.extendConstructor(Definition, {
        Matcher: ObjectMatcher,
        Analyzer: ObjectAnalyzer,
        Merger: ObjectMerger
    });

    return ObjectDefinition;
})();
DefinitionDatabase.register(ObjectDefinition);

export default DefinitionDatabase;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('primitive', function() {
            let definition = DefinitionDatabase.create(true);

            assert(definition.value === true);
            assert(definition.primitiveMark === true);
        });

        this.add('object', function() {
            let definition = DefinitionDatabase.create({
                foo: true,
                bar: true
            });

            assert(definition.properties.length === 2);
        });

        this.add('object with cycle', function() {
            let value = {};
            value.self = value;
            let definition = DefinitionDatabase.create(value);

            assert(definition.pointers.length === 1);
        });

        // maybe the array indexes should not be considered as properties but rather as values
        // because we don't need to know each property name because it's an integer incremented by one
        // for each value (just like set will become)
        // however we know that thoose values may conflict with property names
        // but they are not properties (are they?)
        // I think they should be splitted in two categories
        // and added into something like definition.values
        // but for array definition.values may conflict with properties
        // while for Set, Map (map are special because value are named) they can't
        // because values are private
        // in fact an array got .values() & .properties() while an object got only .properties
        // set have .values() & .properties() but values are private
        // Map have .privateProperties() & properties()
        this.add('for now only array indexes are considered as properties', function() {
            let value = ['a'];
            value.foo = true;
            let definition = DefinitionDatabase.create(value);

            assert(definition.properties.length === 1);
        });
    }
};
