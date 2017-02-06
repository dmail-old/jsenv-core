
import assert from 'node/assert';
import proto from 'proto';

import Schema from '../index.js';

var sampleValues = [
	undefined,
	true,
	false,
	-10,
	10,
	0,
	'',
	'foo',
	function(){},
	{},
	/ok/,
	new Date(),
	new Error()
];

var assertions = {
	definitionThrowFilter(definition, filter){
		try{
			Schema.create(definition);
			throw new Error('definition was expected to throw');
		}
		catch(e){
			if( e.name === 'DefinitionError' ){
				if( filter && !filter(e) ){
					throw e;
				}
			}
			else{
				throw e;
			}
		}
	},

	definitionDoesNotTrhowOrNotWith(definition, filter){
		try{
			Schema.create(definition);
		}
		catch(e){
			if( e.name === 'DefinitionError' ){
				if( filter && !filter(e) ){
					throw e;
				}
			}
			else{
				throw e;
			}
		}
	},

	definitionThrow(definition){
		this.definitionThrowFilter(definition);
	},

	definitionThrowWithCode(definition, code){
		this.definitionThrowFilter(definition, function(e){
			return e.code === code;
		});
	},

	definitionDoesNotThrowWithCode(definition, code){
		this.definitionDoesNotTrhowOrNotWith(definition, function(e){
			return e.code !== code;
		});
	},

	definitionDoesNotThrow(definition){
		Schema.create(definition);
	},

	keywordDefaultValueIs(keyword, defaultValue){
		assert.equal(Schema.create().get(keyword), defaultValue);
	},

	keywordValueTypeMustBe(keyword, type){

		sampleValues.forEach(function(value){
			var definition = {};
			definition[keyword] = value;

			if( typeof value === type ){
				this.definitionDoesNotThrowWithCode(definition, 'TYPE');
			}
			else{
				this.definitionThrowWithCode(definition, 'TYPE');
			}
		}, this);

	},

	keywordValueKindMustBe(keyword, kind){

		sampleValues.forEach(function(value){
			var definition = {};
			definition[keyword] = value;

			if( proto.isOfKind(value, kind) ){
				this.definitionDoesNotThrowWithCode(definition, 'KIND');
			}
			else{
				this.definitionThrowWithCode(definition, 'KIND');
			}
		}, this);

	},

	definitionIs(definition, expectedDefinitionString){
		assert.equal(Schema.create(definition).toDefinitionString(), expectedDefinitionString);
	},

	firstDifferenceNameIs(definition, value, name){
		var schema = Schema.create(definition);
		var differences = schema.listDifferences(value);

		if( differences.length === 0 ){
			assert.fail('expecting first difference name to be ' + name + ' but there is no difference');
		}
		else{
			assert.equal(differences[0].validator.name, name);
		}
	},

	hasDifferenceCount(definition, value, count){
		var schema = Schema.create(definition);
		var differences = schema.listDifferences(value);

		assert.equal(differences.length, count);
	},

	hasNoDifference(definition, value){
		this.hasDifferenceCount(definition, value, 0);
	},

	firstMessageIs(definition, value, expectedMessage){
		var schema = Schema.create(definition);
		var validity = schema.checkValidity(value);

		assert.equal(validity.valid, false);
		assert.equal(validity.createMessage(), expectedMessage);
	}
};

export default assertions;