const test = require('../ensure.js')

const {equals, isString} = test

const suite = test(
	'generate user',
	() => ({age: 10, name: 'damien'}),
	'ensure age is 10',
	(user) => test(
		'age',
		() => user.age,
		'is 10',
		(age) => equals(age, 10)
	),
	'ensure name is damien & is as string',
	(user) => test(
		'name',
		() => user.name,
		'is damien',
		(name) => equals(name, 'damien'),
		'is a string',
		(name) => isString(name)
	)
)
module.exports = () => {
	suite().then(
		(value) => {
			console.log('test result', value)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
