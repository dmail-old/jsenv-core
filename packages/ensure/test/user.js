const test = require('../ensure.js')

const {equals, isString} = test

const suite = test(
	'ensure age is 10',
	(user) => test(
		'is 10',
		(age) => equals(age, 10)
	)(user.age),
	'ensure name is damien & is as string',
	(user) => test(
		'is damien',
		(name) => equals(name, 'damien'),
		'is a string',
		(name) => isString(name)
	)(user.name)
)

module.exports = () => {
	suite({age: 10, name: 'damien'}).then(
		(value) => {
			console.log('test result', value)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
