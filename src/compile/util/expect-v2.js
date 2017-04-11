const expect = (value, ...args) => {
	const assertions = []
	let i = 0
	const j = args.length
	while (i < j) {
		const arg = args[i]
		if (typeof arg === 'string') {
			i++
			if (i < j) {
				assertions.push({
					name: arg,
					fn: args[i]
				})
			}
		}
		else {
			assertions.push({
				name: arg.name || 'anonymous',
				fn: arg
			})
		}
		i++
	}

	const promise = Promise.resolve().then(() => {
		const promises = assertions.map((assertion) => {
			return Promise.resolve(assertion.fn(value)).then((value) => {
				if (value === true) {
					return {
						name: assertion.name,
						state: 'passed',
						reason: 'returned-true'
					}
				}
				if (value === false) {
					return {
						name: assertion.name,
						state: 'failed',
						reason: 'returned-false'
					}
				}
				if (value instanceof Array) {
					return {
						name: assertion.name,
						state: 'passed',
						reason: 'all-passed',
						detail: value
					}
				}
			})
		})
		return Promise.all(promises)
	})
	return promise
}
module.exports = expect

const equals = (value, expectedValue) => {
	return value === expectedValue
}
const isString = (value) => {
	return typeof value === 'string'
}

expect(
	{age: 10, name: 'damien'},
	'user age',
	(user) => expect(
		user.age,
		'is 10',
		(age) => equals(age, 10)
	),
	'user name',
	(user) => expect(
		user.name,
		'is damien',
		(name) => equals(name, 'damien'),
		'is a string',
		(name) => isString(name)
	)
).then(
	(value) => {
		console.log('test passed', value[1])
	},
	(reason) => {
		console.log('test failed', reason)
	}
)
