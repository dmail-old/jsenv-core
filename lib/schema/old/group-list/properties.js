import KeywordGroupList from '../keyword-group-list.js';

var Properties = KeywordGroupList.define('properties', {
	assertions: ['is-object'],
	restrictedTo: 'Object',
	testMode: 'every',

	setAll(value){
		return Object.keys(value).map(function(propertyName){
			const propertyDefinition = value[propertyName];
			const group = this.createChild(propertyDefinition);

			group.propertyName = propertyName;

			return this.addKeyword(group);
		}, this);
	}
});

export default Properties;

export const test = {
	modules: ['node/assert'],

	suite(assert){

		/*
		this.add("expectation message", function(){
			assertSchema.expectationIs(
				{
					properties: {
						name: {type: 'string', equal: 'foo'},
						age: {type: 'number'}
					}
				},
				"when present name must be a string AND name must be foo AND when present age must be a number"
			);
		});
*/

		/*
		add("not message", function(){
			var schema = Schema.create({
				not: {
					properties: {
						name: {type: 'string'}
					}
				}
			});
			var differences = schema.listDifferences({name: 'damien'});

			assert.equal(differences.length, 1);
		});
*/
	}
};