import GroupListKeyword from '../keyword-group-list.js';

var AnyOf = GroupListKeyword.define('anyOf', {
	testMode: 'some'
});

export default AnyOf;

export const test = {
	modules:['node/assert'],
	suite(add, assert){

		this.add("toDefinitionString()", function(){
			function assertKeywordDefinitionStringEquals(keyword, expectedDefinitionString){
				assert.equal(
					keyword.toDefinitionString(),
					expectedDefinitionString
				);
			}

			this.add('basic', function(){
				assertKeywordDefinitionStringEquals(
					AnyOf.create([
						{type: 'string'},
						{type: 'number'}
					]),
					'value must be a string OR value must be a number'
				);
			});

			this.add('reverse()', function(){
				assertKeywordDefinitionStringEquals(
					AnyOf.create([
						{type: 'string'},
						{type: 'number'}
					]).reverse(),
					"value must not be a string AND value must not be a number"
				);
			});
		});

		this.add("getMessageFor()", function(){
			function assertMessageEquals(keyword, value, expectedMessage){
				assert.equal(keyword.getMessageFor(value), expectedMessage);
			}

			this.add('basic', function(){
				assertMessageEquals(
					AnyOf.create([
						{type: 'number'},
						{type: 'boolean'}
					]),
					'foo',
					'value must be a number OR value must be a boolean (got foo)'
				);
			});

			this.add("with mixed validation", function(){
				assertMessageEquals(
					AnyOf.create([
						{type: 'number'},
						{type: 'string', minLength: 10}
					]),
					'foo',
					'value must be a number OR value length must be greater than or equal to 10 (got foo)'
				);
			});

			this.add("reverse()", function(){
				assertMessageEquals(
					AnyOf.create([
						{type: 'string'},
						{type: 'number'}
					]).reverse(),
					'foo',
					'value must not be a string (got foo)'
				);
			});

			this.add("reverse() + many invalid", function(){
				assertMessageEquals(
					AnyOf.create([
						{type: 'string'},
						{equal: 'foo'}
					]).reverse(),
					'foo',
					'value must not be a string AND value must not be equal to foo (got foo)'
				);
			});

		});

		/*
		this.add("message", function(){
			assertSchema.firstMessageIs(
				{
					anyOf: [
						{type: 'number'},
						{
							properties: {
								name: {type: 'string'}
							}
						}
					]
				},
				{name: 10},
				'value must be a number ([object Object] is an object) OR value.name must be a string (10 is a number)'
			);

		});

		this.add("anyOf + allOf", function(){
			assertSchema.firstMessageIs(
				{
					anyOf: [
						{
							allOf: [
								{type: 'object'},
								{kind: 'string'}
							]
						},
						{
							type: 'number'
						}
					]
				},
				true,
				"value must be an object (true is a boolean) AND value must be a string (true is a boolean) OR value must be a number (true is a boolean)"
			);
		});

		this.add("anyOf + anyOf", function(){
			assertSchema.hasDifferenceCount(
				{
					anyOf: [
						{
							anyOf: [
								{type: 'string'},
								{type: 'number'}
							]
						}
					]
				},
				true,
				2
			);
		});
		*/
	}
};