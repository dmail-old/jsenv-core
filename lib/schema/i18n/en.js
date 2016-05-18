/* eslint-disable quote-props */

let i18n = {
    // keyword messages
    "dependency": {
        "": "when {propertyName} is present in {name}, {expected} must be present",
        "not": "when {propertyName} is present in {name}, {expected} must not be present"
    },
    "kind": {
        "": "{name} must be {expected|prefixKind}",
        "not": "{name} must not be {expected|prefixKind}"
    },
    "maximum": {
        "traits": {
            exclusive(instruction) {
                return instruction.args[1] === true;
            }
        },
        "": "{name} must be lower than or equal to {expected}",
        "exclusive": "{name} must be lower than {expected}",
        "not": "{name} must be greater than {expected}",
        "not+exclusive": "{name} must be greater than or equal to {expected}"
    },
    "maxLength": {
        "": "{name} length must be lower than or equal to {expected}",
        "not": "{name} length must be greater than {expected}"
    },
    "maxProperties": {
        "traits": {
            "empty"(result) {
                return result.args[0] < 1;
            }
        },
        "": "{name} must have {expected} #{property} or less",
        "empty": "{name} must not have any #{property}",
        "not": "{name} must have more than {expected} #{property}",
        "not+empty": "{name} must have at least one #{property}"
    },
    "minimum": {
        "traits": {
            exclusive(instruction) {
                return instruction.args[1] === true;
            }
        },
        "": "{name} must be greater than or equal to {expected}",
        "exclusive": "{name} must be greater than {expected}",
        "not": "{name} must be lower than {expected}",
        "not+exclusive": "{name} must be lower than or equal to {expected}"
    },
    "minLength": {
        "": "{name} length must be greater than or equal to {expected}",
        "not": "{name} length must be lower than {expected}"
    },
    "minProperties": {
        "traits": {
            "some"(result) {
                return result.args[0] < 2;
            }
        },
        "": "{name} must have {expected} #{property} or more",
        "some": "{name} must have at least a #{property}",
        "not+some": "{name} must not have any #{property}"
    },
    "multipleOf": {
        "": "{name} must be a multiple of {expected}",
        "not": "{name} must not be a multiple of {expected}"
    },
    "pattern": {
        "": "{name} must be valid against {expected}",
        "not": "{name} must not be valid against {expected}"
    },
    "propertyNames": {
        "traits": {
            "empty"(result) {
                return result.args.length === 0;
            }
        },
        "": "{name} must have {expected|length} property named {expected}",
        "empty": "{name} must not have any property",
        "not": "{name} property names must not be {expected}",
        "not+empty": "{name} must have a property"
    },
    "required": {
        "": "{name} {propertyName} must be present",
        "not": "{name} {propertyName} must not be present"
    },
    "type": {
        "": "{name} must be {expected|prefixType}",
        "not": "{name} must not be {expected|prefixType}"
    },
    "unique": {
        "": "every {name} {propertyName} must be unique",
        "not": "every {name} {propertyName} must not be unique"
    },
    "uniqueValues": {
        "": "every {name} value must be unique",
        "not": "every {name} value must not be unique"
    }
};

export default i18n;

export const test = {
    modules: ['@node/assert', './message.js'],

    main(/* assert, ValidationMessage */) {
        /*
        this.add("createDefinitionMessage()", function(){
            ValidationMessage.languages['en'] = englishLanguage;

            function assertDefinitionMessageEquals(keyword, expectedDefinitionMessage){
                return assert.equal(ValidationMessage.createDefinitionMessage(keyword), expectedDefinitionMessage);
            }

            var add = function(keywordPath, fn){
                this.add({
                    name: keywordPath,
                    modules: ['./keyword/' + keywordPath + '.js'],
                    mapDefaultExports: true,
                    fn: fn
                });
            }.bind(this);

            add('group/each', function(Each){
                this.add("definition", function(){
                    assertDefinitionMessageEquals(
                        Each.create({
                            type: 'string',
                            equal: 'foo'
                        }),
                        'each(value must be a string AND value must be equal to foo)'
                    );
                });
            });

            add('abstract/not', function(Not){
                this.add("definition", function(){
                    assertDefinitionMessageEquals(
                        Not.create({
                            type: 'string',
                            equal: 'foo'
                        }),
                        'not(value must be a string AND value must be equal to foo)'
                    );
                });
            });

            add('assert/dependency', function(Dependency){
                this.add("definition", function(){
                    this.add("basic", function(){
                        assertDefinitionMessageEquals(
                            Dependency.create('firstName').setProperty('name'),
                            'when name is present in value, firstName must be present'
                        );
                    });

                    this.add("reversed", function(){
                        assertDefinitionMessageEquals(
                            Dependency.create('firstName').setProperty('name').reverse(),
                            'when name is present in value, firstName must not be present'
                        );
                    });
                });
            });

            add('assert/equal', function(Equal){
                this.add("definition", function(){
                    this.add("basic", function(){
                        assertDefinitionMessageEquals(
                            Equal.create(10),
                            'value must be equal to 10'
                        );
                    });

                    this.add("reversed", function(){
                        assertDefinitionMessageEquals(
                            Equal.create(10).reverse(),
                            'value must not be equal to 10'
                        );
                    });
                });
            });

            add('assert/includes', function(Includes){
                this.add("definition", function(){
                    this.add("basic", function(){
                        assertDefinitionMessageEquals(
                            Includes.create('foo'),
                            'value must includes foo'
                        );
                    });

                    this.add("reversed", function(){
                        assertDefinitionMessageEquals(
                            Includes.create('foo').reverse(),
                            'value must not includes foo'
                        );
                    });
                });
            });

        });
        */
    }
};

/*
// http://robotlolita.me/2016/01/09/no-i-dont-want-to-configure-your-app.html
// https://gist.github.com/andrei-m/982927
--- propertyNames ---
transformMessage(message, validity){
        var assertEmpty = this.value.length === 0;
        var isReversed = this.isReversed();

        if( (assertEmpty && false === isReversed) || (false === isReversed && false === assertEmpty) ){
            message+= ' ' + this.createStringFromTemplate('(got {differentPropertyNames})', function(name){
                if( name === 'differentPropertyNames' ){
                    return validity.meta.differentPropertyNames;
                }
            }, this);
        }

        return message;
    }
--- unique ---
transformMessage(message, validity){
        if( false === this.isReversed() ){
            message+= ' ' + this.createStringFromTemplate('({duplicateValue} found {count} times for keys {duplicateKeys})', function(name){
                if( name === 'duplicateValue' ){
                    return validity.value[validity.meta.duplicateKeys[0]][this.params.propertyName];
                }
                else if( name === 'count' ){
                    return validity.meta.duplicateKeys.length;
                }
                else if( name === 'duplicateKeys' ){
                    return validity.meta.duplicateKeys;
                }
            }, this);
        }

        return message;
    }
--- uniqueValues ---
transformMessage(message, validity){
        if( false === this.isReversed() ){
            message+= ' ' + this.createStringFromTemplate('({duplicateValue} found {count} times for keys {duplicateKeys})', function(name){
                if( name === 'duplicateValue' ){
                    return validity.value[validity.meta.duplicateKeys[0]];
                }
                else if( name === 'count' ){
                    return validity.meta.duplicateKeys.length;
                }
                else if( name === 'duplicateKeys' ){
                    return validity.meta.duplicateKeys;
                }
            }, this);
        }

        return message;
    }
*/
