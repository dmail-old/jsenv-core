/*

https://github.com/hapijs/joi

*/

import proto from 'proto';
import DependencyGraph from 'jsenv/dependency-graph';

import Instruction from './instruction/index.js';
import FormatInstruction from './instruction/instruction-format.js';
import macro from './instruction/macro.js';
import Keyword from './keyword/index.js';

// import macro from '../instruction/macro.js';
// import {EachPropertyInstruction} from '../instruction/instruction-list.js';
// import SortedArray from './util/array-sorted.js';

const Schema = proto.extend('Schema', {
    keywords: null,
    parent: null,

    constructor() {
        this.keywords = [];
    },

    // wrap all instruction in an object because javaScript does not allow to pass a value by reference
    referenceEnabled: false,
    referencePropertyName: 'ref',

    enableReference() {
        this.referenceEnabled = true;
    },

    disableReference() {
        this.referenceEnabled = false;
    },

    group: undefined,
    name: undefined,
    create(definition) {
        let schema = proto.create.apply(this, arguments);

        if (this.referenceEnabled) {
            schema.group = 'properties';
            schema.name = this.referencePropertyName;
        }

        if (definition) {
            schema.addAll(definition);
        } else {
            schema.updateInstruction();
        }

        return schema;
    },

    createChild() {
        let child = proto.create.apply(Object.getPrototypeOf(this), arguments);

        child.parent = this;

        return child;
    },

    addKeyword(keyword) {
        keyword.schema = this;
        this.keywords.push(keyword);
        keyword.callHook('added');

        if ('transform' in keyword) {
            // console.log('before transform', keyword.name, keyword.args);
            let transformedValue = keyword.transform(keyword.value);
            // console.log('transform keyword value for', keyword.name, 'from', keyword.value, 'to', transformedValue);
            keyword.transformedValue = transformedValue;
        }
    },

    addAll(definition) {
        if (typeof definition !== 'object' || definition === null) {
            throw new TypeError(this.group + ' schema definition must be a non null object');
        }

        // console.log('addAll', Object.keys(definition).sort(Keyword.compareNamesDefinitionOrder.bind(Keyword)));

        Object.keys(definition).sort(
            Keyword.compareNamesDefinitionOrder.bind(Keyword)
        ).forEach(function(name) {
            let KeywordPrototype = Keyword.getPrototypeByName(name);
            let value = definition[name];
            let dependencies = KeywordPrototype.dependencies.map(function(dependencyPrototype) {
                let dependencyIndex = this.keywords.findIndex(function(keyword) {
                    return keyword.name === dependencyPrototype.name;
                });
                return dependencyIndex > -1 ? this.keywords[dependencyIndex] : dependencyPrototype;
            }, this);
            // console.log('create keyword', name, 'with args', value, dependencies);
            let keyword = KeywordPrototype.create(value, dependencies);
            let keywordSchema = this;

            keywordSchema.addKeyword(keyword);
        }, this);

        this.updateInstruction();
    },

    get path() {
        let schemaPath = [];
        let parentSchema = this.parent;

        while (parentSchema) {
            let name = parentSchema.name;
            if (name) {
                schemaPath.unshift(name);
            }
            let group = parentSchema.group;
            if (group !== undefined) {
                schemaPath.unshift(group);
            }

            parentSchema = parentSchema.parent;
        }

        return schemaPath;
    },

    get valuePath() {
        let valuePath = [];
        let parentSchemaOrSelf = this;

        while (parentSchemaOrSelf) {
            if (parentSchemaOrSelf.group === 'properties') {
                valuePath.unshift(parentSchemaOrSelf.name);
            }
            parentSchemaOrSelf = parentSchemaOrSelf.parent;
        }

        return valuePath;
    },

    get depth() {
        return this.valuePath.length;
    },

    filter(keyword) {
        return keyword.isActive();
    },

    sort(/* a, b */) {
        return 0;
    },

    createInstruction() {
        let schemaPath = this.path;
        let valuePath = this.valuePath;
        let operation = macro();

        // if (this.referenceEnabled) {
        operation.setPath(valuePath);
        // }

        this.keywords.filter(
            this.filter.bind(this)
        ).sort(
            this.sort.bind(this)
        ).forEach(function(keyword) {
            let requiredDepth = keyword.requiredDepth || 0;
            let keywordInstruction;
            let instructionPath;

            if (requiredDepth) {
                // propertyNotation keyword are not executed on the value but rather on parent value
                instructionPath = valuePath.slice(0, -requiredDepth);
            } else {
                instructionPath = valuePath;
            }

            // console.log('and', keyword.name);

            keywordInstruction = keyword.createInstruction();
            keywordInstruction.origin = schemaPath;
            keywordInstruction.setPath(instructionPath);

            operation.and(keywordInstruction);
        }, this);

        return operation;
    },

    updateInstruction() {
        this.instruction = this.createInstruction();
    },

    exec(value, options) {
        if (this.hasOwnProperty('instruction') === false) {
            throw new Error('cannot exec() schema without instruction');
        }

        let instruction = this.instruction;
        let result;

        if (this.referenceEnabled) {
            let valueContainer = {
                [this.referencePropertyName]: value
            };

            result = instruction.exec(valueContainer, options);
            // I should remove every 'ref' from every result instruction.path
            // but that would not make sense after all
            // I think reference will be the default behaviour and user will not be allowed to prevent it
        } else {
            result = instruction.exec(value, options);
        }

        return result;
    },

    validate(value, options) {
        let result = this.exec(value, options);

        if (result.isFalsy()) {
            throw result;
        }

        return this.referenceEnabled ? result.value.ref : result.value;
    }
});

Schema.enableReference();

const BooleanKeyword = {};
const TrueKeyword = Object.assign({}, BooleanKeyword, {
    activeValue: true
});
// propertyNotation have in common that they splice(0, 0, propertyName) on instruction args
const PropertyNotation = {
    requiredDepth: 1
};
const FalseNegateKeyword = {
    createInstruction() {
        let instruction = Keyword.createInstruction.apply(this, arguments);

        if (this.value === false) {
            instruction = instruction.not();
        }

        return instruction;
    }
};
const KeywordHoldingSchema = {
    transform(value) {
        let schema = this.schema.createChild();

        schema.group = this.name;
        schema.name = '';
        schema.addAll(value);

        return schema;
    },

    get instructionArgs() {
        return [this.transformedValue.instruction];
    }
};
const KeywordHoldingSchemaList = {
    transform(value) {
        return value.map(function(value, index) {
            let schema = this.schema.createChild();

            schema.group = this.name;
            schema.name = index;
            schema.addAll(value);

            return schema;
        }, this);
    },

    get instructionArgs() {
        return this.transformedValue.map(function(schema) {
            return schema.instruction;
        });
    }
};

function registerKeyword(name) {
    let properties = [name];
    let i = 1;
    let j = arguments.length;
    for (;i < j; i++) {
        properties.push(arguments[i]);
    }

    return Keyword.register.apply(Keyword, properties);
}

function capitalizeFirst(string) {
    return string[0].toUppercase() + string.slice(1);
}

function registerKeywordFromInstruction(instructionName, keywordName) {
    let instructionPrototype = Instruction.getPrototypeByName(instructionName);
    let instructionConstructorSchema = instructionPrototype.constructorSchema;
    let expectNoArgument = instructionPrototype.getMinArgumentLength() === 0;
    let instructionProperty = {
        instructionPrototype: instructionPrototype
    };

    if (arguments.length === 1) {
        keywordName = instructionName;
    }

    if (expectNoArgument) {
        if (FormatInstruction.isPrototypeOf(instructionPrototype)) {
            return registerKeyword(
                keywordName,
                TrueKeyword,
                instructionProperty
            );
        }

        return registerKeyword(
            keywordName,
            FalseNegateKeyword,
            instructionProperty
        );
    }

    let KeywordPrototype = registerKeyword(
        keywordName,
        instructionProperty
    );

    if (Array.isArray(instructionConstructorSchema)) {
        instructionConstructorSchema.slice(1).forEach(function(instructionArgDefinition) {
            KeywordPrototype.registerParameter(
                keywordName + capitalizeFirst(instructionArgDefinition.name),
                instructionArgDefinition.default
            );
        });
    }

    return KeywordPrototype;
}

// any transformers
const Cast = registerKeywordFromInstruction('cast');
// any assertions
const Kind = registerKeywordFromInstruction('kind');
const Is = registerKeywordFromInstruction('is');
const Equals = registerKeywordFromInstruction('equals');
const Includes = registerKeywordFromInstruction('includes');
const PartOf = registerKeywordFromInstruction('partOf');
const MaxProperties = registerKeywordFromInstruction('maxProperties');
const MinProperties = registerKeywordFromInstruction('minProperties');
const UniqueValues = registerKeywordFromInstruction('valueAreUnique', 'uniqueValues');
const Enum = registerKeywordFromInstruction('equalsOneOf', 'enum');
// string transformers
const TrimLeft = registerKeywordFromInstruction('trimLeft');
const TrimRight = registerKeywordFromInstruction('trimRight');
const Trim = registerKeywordFromInstruction('trim');
const TrimMultiple = registerKeywordFromInstruction('trimMultiple');
const PadLeft = registerKeywordFromInstruction('padLeft');
const PadRight = registerKeywordFromInstruction('padRight');
const Pad = registerKeywordFromInstruction('pad');
const Truncate = registerKeywordFromInstruction('truncate');
// string assertions
const LeftBlank = registerKeywordFromInstruction('startsWithBlank');
const RightBlank = registerKeywordFromInstruction('endsWithBlank');
const Blank = registerKeywordFromInstruction('hasSideBlank');
const MultipleBlank = registerKeywordFromInstruction('includesMultipleBlank');
const Pattern = registerKeywordFromInstruction('pattern');
const MaxLength = registerKeywordFromInstruction('maxLength');
const MinLength = registerKeywordFromInstruction('minLength');
// number transformers
const Round = registerKeywordFromInstruction('round');
const RoundNearestMultipleOf = registerKeywordFromInstruction('roundMultipleOf');
const Minimum = registerKeywordFromInstruction('minimum');
const Maximum = registerKeywordFromInstruction('maximum');
// number assertions
const MultipleOf = registerKeywordFromInstruction('multipleOf');
const Precision = registerKeywordFromInstruction('precision');
// const Below = registerKeywordFromInstruction('below');
// const Above = registerKeywordFromInstruction('above');

const Required = registerKeyword(
    'required',
    TrueKeyword,
    PropertyNotation,
    {
        instructionPrototype: Instruction.getPrototypeByName('hasProperty'),
        get instructionArgs() {
            return [this.schema.name];
        }
    }
);

const Dependencies = registerKeyword(
    'dependencies',
    PropertyNotation,
    {
        instructionPrototype: Instruction.getPrototypeByName('propertyDependencies'),
        get instructionArgs() {
            let args = [];
            let propertyName = this.schema.name;
            let dependencies = this.value;

            args.push(propertyName);
            args.push.apply(args, dependencies);

            return args;
        }
    }
);

const Default = registerKeyword(
    'default',
    PropertyNotation,
    {
        instructionPrototype: Instruction.getPrototypeByName('ensurePropertyValue'),
        get instructionArgs() {
            let propertyName = this.schema.name;
            let defaultValue = this.value;
            let args = [propertyName, defaultValue];

            // console.log('default params', this.dependencies);

            // combination of dependencies & default means:
            // (a) all keywords related to this property must be runned after the dependencies
            // (b) even if the property does not exists yet, a default will be provided so dependencies must exists
            // even if the property depending on them does not exists yet
            if (typeof defaultValue === 'function') {
                let dependenciesKeyword = this.args[1];
                if (dependenciesKeyword) {
                    let dependencies = dependenciesKeyword.value;
                    console.log('abstract property names', propertyName, 'based on', dependencies);
                    if (dependencies && dependencies.length) {
                        let createGetterArgsFromDependencies = function createGetterArgsFromDependencies(value) {
                            return dependencies.map(function(dependencyName) {
                                return value[dependencyName];
                            });
                        };

                        args.push(createGetterArgsFromDependencies);
                    }
                }
            }

            return args;
        }
    }
);
Default.addDependency(Dependencies);

const Unique = registerKeyword('unique',
    TrueKeyword,
    PropertyNotation,
    {
        requiredDepth: 2,
        instructionPrototype: Instruction.getPrototypeByName('propertyValueAreUnique'),
        get instructionArgs() {
            return [this.schema.name];
        }
    }
);

const Properties = registerKeyword(
    'properties',
    {
        transform(value) {
            let propertiesDefinition = value;
            let group = this.name;
            let schemasGraph = DependencyGraph.create();
            let propertyNames = Object.keys(propertiesDefinition);

            propertyNames.forEach(function(propertyName) {
                let propertyDefinition = propertiesDefinition[propertyName];
                schemasGraph.register(propertyName, propertyDefinition.dependencies);
            });

            return schemasGraph.sort().filter(function(propertyName) {
                // a property may declare a dependency but this depedency may not have any definition
                return propertyNames.includes(propertyName);
            }).map(function(propertyName) {
                let propertyDefinition = propertiesDefinition[propertyName];
                // console.log('property', propertyName, 'definition', propertyDefinition);
                let propertySchema = this.schema.createChild();

                propertySchema.group = group;
                propertySchema.name = propertyName;
                propertySchema.addAll(propertyDefinition);

                return propertySchema;
            }, this);
        },

        instructionPrototype: Instruction.getPrototypeByName('allOf'),
        get instructionArgs() {
            let propertySchemas = this.transformedValue;

            return propertySchemas.map(function(propertySchema) {
                return propertySchema.instruction;
            });
        }
    }
);
// when properties is an empty object just skip the keyword considering it's true
Properties.addInactiveReason({
    name: 'empty',
    check(keyword) {
        // console.log('properties length', Object.keys(keyword.value));
        return Object.keys(keyword.value).length === 0;
    }
});

const AdditionalProperties = registerKeyword(
    'additionalProperties',
    BooleanKeyword,
    {
        activeValue: false,
        instructionPrototype: Instruction.getPrototypeByName('propertiesAre'),
        get instructionArgs() {
            // console.log('properties are', this.args[]);
            return Object.keys(this.args[1].value);
        }
    }
);
AdditionalProperties.addRequiredDependency(Properties);

const Not = registerKeyword(
    'not',
    KeywordHoldingSchema,
    {
        createInstruction() {
            // create a schema from not keyword value and return its operation reversed using not()
            return this.transformedValue.instruction.not();
        }
    }
);

const Values = registerKeyword(
    'values',
    KeywordHoldingSchema,
    {
        instructionPrototype: Instruction.getPrototypeByName('eachProperty'),
        get instructionArgs() {
            let schema = this.transformedValue;
            let instruction = schema.instruction;

            // console.log('values schema path', schema.path, 'value path', schema.valuePath);

            return [instruction];
        }
    }
);

const AllOf = registerKeyword(
    'allOf',
    KeywordHoldingSchemaList,
    {
        instructionPrototype: Instruction.getPrototypeByName('allOf')
    }
);

const AnyOf = registerKeyword(
    'anyOf',
    KeywordHoldingSchemaList,
    {
        instructionPrototype: Instruction.getPrototypeByName('anyOf')
    }
);

const OneOf = registerKeyword(
    'oneOf',
    KeywordHoldingSchemaList,
    {
        instructionPrototype: Instruction.getPrototypeByName('oneOf')
    }
);

// console.log(Keyword.getPrototypesOrderedByDependency().map(function() { return arguments[0].name; }));

(function() {
    // keyword must be executed in a specific order
    let keywordExecutionOrder = [
        // keywords that may change value must be executed first
        Not,
        AllOf,
        AnyOf,
        OneOf,
        Cast,
        Round,
        RoundNearestMultipleOf,
        // Above,
        // Below,
        PadLeft,
        PadRight,
        Pad,
        Truncate,
        TrimLeft,
        TrimRight,
        TrimMultiple,
        Trim,
        // keyword below check stuff relative to the value without impacting it nor any property
        Kind,
        Is,
        Equals,
        Enum,
        Includes,
        PartOf,
        Minimum,
        Maximum,
        Precision,
        MultipleOf,
        LeftBlank,
        RightBlank,
        Blank,
        MultipleBlank,
        MaxLength,
        MinLength,
        Pattern,
        // property
        Default, // may change a property value but not the value itself
        Dependencies,
        Required,
        // may change property value but not the number of properties, nor the value
        Properties,
        // now we check stuff related to the number of properties
        MaxProperties,
        MinProperties,
        AdditionalProperties,
        // it can change any property value but not the number of properties
        Values,
        // uniqueValues check unicity of property values so it must be run once property value cannot change anymore
        UniqueValues,
        // just like uniqueValues, unique is sensitive to the number of properties and their values so it's the last one
        // but because it's runned on the grand parent I'm not sure it's sufficient
        Unique
    ];

    function getKeywordExecutionOrder(keyword) {
        return keywordExecutionOrder.findIndex(function(KeywordPrototype) {
            return KeywordPrototype.name === keyword.name;
        });
    }

    function compareKeyword(a, b) {
        return getKeywordExecutionOrder(a) - getKeywordExecutionOrder(b);
    }

    Schema.sort = compareKeyword;
})();

export default Schema;

/*
http://json-schema.org/latest/json-schema-validation.html#anchor26
http://json-schema.org/example1.html
*/

export const test = {
    modules: ['node/assert'],

    suite(assert) {
        this.add("unknownDefinitionName keyword is uknown", function() {
            assert.throws(
                function() {
                    Schema.create({
                        unknownDefinitionName: 'foo'
                    });
                },
                function(e) {
                    return e.code === 'UNKNOWN';
                }
            );
        });

        function assertTruthy(definition, value) {
            assert(Schema.create(definition).exec(value).isTruthy());
        }

        function assertFalsy(definition, value) {
            assert(Schema.create(definition).exec(value).isFalsy());
        }

        this.add("one", function() {
            assertTruthy(
                {
                    kind: 'string'
                },
                'foo'
            );
        });

        this.add("properties", function() {
            this.add("empty", function() {
                assertTruthy(
                    {
                        properties: {}
                    },
                    {foo: 'bar'}
                );
            });

            this.add("core", function() {
                assertTruthy(
                    {
                        properties: {
                            name: {
                                kind: 'string'
                            }
                        }
                    },
                    {name: 'foo'}
                );
            });

            this.add("default + type", function() {
                assertTruthy(
                    {
                        properties: {
                            name: {
                                default: 'foo',
                                kind: 'string'
                            }
                        }
                    },
                    {}
                );
            });

            this.add("default + required", function() {
                assertTruthy(
                    {
                        properties: {
                            name: {
                                default: 'foo',
                                required: true
                            }
                        }
                    },
                    {}
                );
            });

            this.add("default + dependencies", function() {
                let value = {
                    birthdate: new Date(1990, 27, 4)
                };

                assertTruthy(
                    {
                        properties: {
                            birthdayNumber: {
                                dependencies: ['birthdate'],
                                default(birthdate) {
                                    return birthdate.getDate();
                                }
                            }
                        }
                    },
                    value
                );
            });

            this.add("unique", function() {
                let value = [{}, {}];

                assertFalsy(
                    {
                        properties: {
                            0: {
                                properties: {
                                    name: {
                                        default: 10,
                                        unique: true
                                    }
                                }
                            },
                            1: {
                                properties: {
                                    name: {
                                        default: 10,
                                        unique: true
                                    }
                                }
                            }
                        }
                    },
                    value
                );

                assert.equal(value[0].name, 10);
                assert.equal(value[1].name, undefined);
            });
        });

        this.add("values", function() {
            assertTruthy(
                {
                    values: {
                        kind: 'number'
                    }
                },
                [10, 11]
            );

            assertTruthy(
                {
                    values: {
                        properties: {
                            name: {
                                kind: 'string'
                            }
                        }
                    }
                },
                [{name: 'damien'}]
            );

            assertTruthy(
                {
                    values: {
                        properties: {
                            names: {
                                values: {
                                    kind: 'string'
                                }
                            }
                        }
                    }
                },
                [
                    {
                        names: ['damien']
                    }
                ]
            );
        });

        this.add("not", function() {
            assertTruthy(
                {
                    not: {
                        kind: 'string'
                    }
                },
                10
            );
        });

        this.add("additionalProperties", function() {
            assertTruthy(
                {
                    properties: {
                        name: {}
                    },
                    additionalProperties: false
                },
                {
                    name: true
                }
            );

            assertTruthy(
                {
                    properties: {},
                    additionalProperties: false
                },
                {}
            );

            assertFalsy(
                {
                    properties: {},
                    additionalProperties: false
                },
                {
                    name: true
                }
            );
        });

        // meta definition is allowed and just store information about the value
        this.add("meta keyword is allowed", function() {
            assert.doesNotThrow(
                function() {
                    Schema.create({
                        meta: {}
                    });
                }
            );
        }).skip('meta not implemented');

        // this.addFile("./keyword").skip();
    }
};
