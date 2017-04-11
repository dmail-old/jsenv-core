const spy = require('./spy.js')
const ensureThenable = require('./ensure-thenable.js')

const defaultMaxDuration = 1000 * 3
const Thenable = Promise

const terminationBefore = (fn, ms) => {
	fn = ensureThenable(fn)
	function ensureTerminatedBefore(context) {
		let id
		return Thenable.race([
			fn(context),
			new Thenable((resolve) => {
				id = setTimeout(() => {
					context.fail('still pending after', ms)
					resolve()
				}, ms)
			})
		]).then(
			(value) => {
				clearTimeout(id)
				return value
			},
			(reason) => {
				clearTimeout(id)
				return Thenable.reject(reason)
			}
		)
	}
	return ensureTerminatedBefore
}
expect.terminationBefore = terminationBefore

const expect = (...tests) => {
	let run = ({
		value,
		maxDuration = defaultMaxDuration
	} = {}) => {
		const context = {
			value,
			maxDuration,
		}
		let i = 0
		const j = tests.length
		let currentTest
		const outputs = []
		const compositeOutput = {}

		const runTest = () => {
			const output = {
				status: 'pending'
			}
			context.output = output
			context.pass = (reason, detail) => {
				Object.assign(output, {
					status: 'passed',
					reason,
					detail,
				})
			}
			context.fail = (reason, detail) => {
				Object.assign(output, {
					status: 'failed',
					reason,
					detail,
				})
			}

			const returnValue = currentTest(context)
			return Thenable.resolve(returnValue).then(
				(value) => {
					if (value === context) {
						// something special if we return the context?
						// je sais pas trop mais en tous cas il faut un truc genre composeContext
						// pour qu'on puisse composer le résultat de deux expect()
					}
					if (output.status === 'pending') {
						if (value === true) {
							context.pass('resolved-to-true')
						}
						else if (value === false) {
							context.fail('resolved-to-false')
						}
						else {
							context.pass('resolved', value)
						}
					}
				},
				(reason) => {
					context.fail('rejected', reason)
				}
			)
		}
		const next = () => {
			if (i === j) {
				compositeOutput.status = 'passed'
				compositeOutput.reason = 'all-passed'
				return compositeOutput
			}
			currentTest = tests[i]
			i++

			return runTest().then(() => {
				const {output} = context
				outputs.push(output)
				if (output.status === 'failed') {
					compositeOutput.status = 'failed'
					compositeOutput.reason = 'failed child'
					compositeOutput.detail = outputs
					return compositeOutput
				}
				return next()
			})
		}

		// sauf qu'il manque un context.fail & context.pass
		// pour que ça marche
		return terminationBefore(next, maxDuration)(context)
	}
	return run
}
module.exports = expect

const forward = (fn) => {
	return (context) => {
		context.value = fn(context.value)
	}
}
const forwardThrow = (fn) => {
	return (context) => {
		try {
			fn(context.value)
			context.fail('expected to throw')
		}
		catch (e) {
			context.value = e
		}
	}
}
const forwardResolution = () => {
	return (context) => {
		return Promise.resolve(context.value).then((value) => {
			context.value = value
		})
	}
}
const execution = () => {
	return (context) => {
		return context.value.firstCall().then((call) => {
			if (call) {
				context.value = call
				context.pass('executed')
			}
		})
	}
}
expect.execution = execution

// ensure.pendingAfter would be the opposite of terminationBefore

const equals = (expectedValue) => {
	return ({value, pass, fail}) => {
		if (value === expectedValue) {
			return pass('equals')
		}
		return fail('value does not equal', expectedValue)
	}
}
// const sequencing = (...spies) => {
// 	return () => {
// 		const calls = []
// 		return Promise.all(spies.map((spy, index) => {
// 			return spy.firstCall().then((call) => {
// 				if (index > 0) {
// 					const previous = calls[index - 1]
// 					if (!previous || call.temporalValue > previous.temporalValue) {
// 						return fail(`${spy} resolved before ${spies[index - 1]}`)
// 					}
// 				}
// 				calls.push(call)
// 				return pass('order is respected')
// 			})
// 		}))
// 	}
// }
// expect.sequencing = sequencing

const isString = () => {
	return ({value, pass, fail}) => {
		if (typeof value === 'string') {
			return pass('string')
		}
		return fail('not a string')
	}
}
const isFunction = () => {
	return ({value, pass, fail}) => {
		if (typeof value === 'function') {
			return pass('function')
		}
		return fail('not a function')
	}
}

// multiple expect + forwarding
{
	const usedHas10AndIsNamedDamien = expect(
		forward(() => {
			return {age: 10, name: 'damien'}
		}),
		expect(
			forward((value) => value.age),
			equals(10)
		),
		expect(
			forward((value) => value.name),
			equals('damien'),
			isString()
		)
	)
	usedHas10AndIsNamedDamien().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
// forwardThrow
{
	const fooMethodThrowWith10 = expect(
		forward(() => {
			return {
				foo() {
					throw 10 // eslint-disable-line no-throw-literal
				}
			}
		}),
		forward((value) => value.foo),
		isFunction(),
		forwardThrow((foo) => foo()),
		equals(10)
	)
	fooMethodThrowWith10().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
// forwardResolution on spy
{
	const spyedMethodCalledWith10 = expect(
		forward(() => {
			const object = {foo: spy()}
			object.foo(10)
			return object
		}),
		forward((value) => value.foo),
		forward((spy) => spy.firstCall()),
		forwardResolution(),
		forward((firstCall) => firstCall.args[0]),
		equals(10)
	)
	spyedMethodCalledWith10().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
// todo : Destructuring (faire destructuring/test.js avec cette api)
// todo: forwardRejection
// todo: pendingAfter()
// todo: settledBefore()
// todo: sequencing of spy
