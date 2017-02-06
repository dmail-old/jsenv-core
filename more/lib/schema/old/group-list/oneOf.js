import GroupListKeyword from '../keyword-group-list.js';

var OneOf = GroupListKeyword.define('oneOf', {
	testMode: 1
});

export default OneOf;

export const test = {
	modules:['../../assert.js'],

	suite(add, assertSchema){
		assertSchema = assertSchema.default;

		this.add("expectation message", function(){
			assertSchema.expectationIs(
				{
					oneOf: [
						{type: 'string'},
						{equal: 'foo'}
					]
				},
				'one of value must be a string AND value must be foo'
			);

			assertSchema.expectationIs(
				{
					oneOf: [
						{not: {type: 'number'}},
						{maxLength: 10}
					]
				},
				'one of value must not be a number AND value length must be lower than 10'
			);

			assertSchema.expectationIs(
				{
					not: {
						oneOf: [
							{type: 'string'},
							{equal: 'foo'}
						]
					}
				},
				'none or more than one of value must be a string AND value must be foo'
			);
		});

		this.add("message", function(){
			assertSchema.firstMessageIs(
				{
					oneOf: [
						{type: 'number'},
						{type: 'boolean'}
					]
				},
				'foo',
				'value must be a number (foo is a string) OR value must be a boolean (foo is a string)'
			);

			assertSchema.firstMessageIs(
				{
					oneOf: [
						{type: 'number'},
						{equal: 5},
						{minimum: 5}
					]
				},
				5,
				'value must not be 5 AND value must be lower than 5 (got 5)'
			);
		});

		this.add("not message", function(){
			assertSchema.firstMessageIs(
				{
					not: {
						oneOf: [
							{type: 'string'},
							{type: 'number'}
						]
					}
				},
				'foo',
				'value must not be a string (got foo)'
			);

			// it's allOf so it's ok
			assertSchema.firstMessageIs(
				{
					not: {
						oneOf: [
							{type: 'string'},
							{equal: 'foo'}
						]
					}
				},
				'foo',
				''
			);
		});
	}
};