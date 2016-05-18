import KeywordGroupList from '../keyword-group-list.js';

var AllOf = KeywordGroupList.define('allOf', {
	testMode: 'every'
});

export default AllOf;

export const test = {
	modules: ['node/assert'],
	suite(add, assert){

		this.add("toDefinitionString()", function(){

			function assertKeywordDefinitionStringEquals(keyword, expectedDefinitionString){
				assert.equal(
					keyword.toDefinitionString(),
					expectedDefinitionString
				);
			}

			function assertDefinitionStringEquals(definition, expectedDefinitionString){
				assertKeywordDefinitionStringEquals(AllOf.create(definition), expectedDefinitionString);
			}


			this.add('basic', function(){
				assertDefinitionStringEquals(
					[
						{type: 'string'},
						{equal: 'foo'}
					],
					'value must be a string AND value must be equal to foo'
				);
			});

			this.add("reverse()", function(){
				assertKeywordDefinitionStringEquals(
					AllOf.create(
						[
							{type: 'string'},
							{equal: 'foo'}
						]
					).reverse(),
					'value must not be a string OR value must not be equal to foo'
				);
			});

			this.add("reverse() + keyword reverse()", function(){
				var allOf = AllOf.create([
					{type: 'string'},
					{equal: 'foo'}
				]);

				allOf.reverse();
				allOf.list[0].keywords[0].reverse();

				assertKeywordDefinitionStringEquals(
					allOf,
					'value must be a string OR value must not be equal to foo'
				);
			});

			this.add("reverse() + nested reverse()", function(){
				var allOf = AllOf.create([
					{
						allOf: [
							{type: 'string'},
							{equal: 'foo'}
						]
					}
				]);

				allOf.reverse();
				allOf.list[0].keywords[0].reverse();

				assertKeywordDefinitionStringEquals(
					allOf,
					'value must be a string AND value must be equal to foo'
				);
			});
		});

		this.add("getMessageFor()", function(){
			function assertMessageEquals(keyword, value, expectedMessage){
				assert.equal(keyword.getMessageFor(value), expectedMessage);
			}

			this.add("basic", function(){
				assertMessageEquals(
					AllOf.create([
						{type: 'number'},
						{type: 'boolean'}
					]),
					'foo',
					'value must be a number (got foo)'
				);
			}).skip();

			this.add("reverse()", function(){
				assertMessageEquals(
					AllOf.create([
						{type: 'string'},
						{equal: 'foo'}
					]).reverse(),
					'foo',
					'value must not be a string OR value must not be equal to foo (got foo)'
				);
			});

			this.add("reverse() + nested allOf", function(){
				assertMessageEquals(
					AllOf.create([
						{type: 'string'},
						{equal: 'foo'},
						{
							allOf: [
								{minLength: 2}
							]
						}
					]).reverse(),
					'foo',
					'value must not be a string OR value must not be equal to foo OR value length must be greater than or equal to 2 (got foo)'
				);
			});
		});

	}
};