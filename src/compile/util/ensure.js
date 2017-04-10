const spy = require('./spy.js')
const ensureThenable = require('./ensure-thenable.js')

const defaultMaxDuration = 1000 * 3
const Thenable = Promise

function Output(properties) {
	Object.assign(this, properties)
}
const createOutput = (properties) => {
	return new Output(properties)
}
const isOutput = (a) => {
	return a instanceof Output
}
const pass = (reason, detail) => {
	return createOutput({
		status: 'passed',
		reason,
		detail,
	})
}
const fail = (reason, detail) => {
	return createOutput({
		status: 'failed',
		reason,
		detail,
	})
}
// const cast = (value) => {
// 	if (value === true) {
// 		value = pass('returned-true')
// 	}
// 	else if (value === false) {
// 		value = fail('returned-false')
// 	}
// 	return value
// }

const terminationBefore = (fn) => {
	fn = ensureThenable(fn)
	function ensureTerminatedBefore(ms) {
		let id
		return Thenable.race([
			fn.apply(this, arguments),
			new Thenable((resolve) => {
				id = setTimeout(() => {
					resolve(fail('still pending after', ms))
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
const rejection = (fn) => {
	fn = ensureThenable(fn)
	return () => {
		return fn().then(
			(value) => {
				return fail(`expected to reject but resolved with: ${value}`)
			},
			(reason) => reason
		)
	}
}
const equals = (expectedValue) => {
	return (value) => {
		if (value === expectedValue) {
			return pass('equals')
		}
		return fail('value does not equal', expectedValue)
	}
}

const sequencing = (...spies) => {
	return () => {
		const calls = []
		return Promise.all(spies.map((spy, index) => {
			return spy.firstCall().then((call) => {
				if (index > 0) {
					const previous = calls[index - 1]
					if (!previous || call.temporalValue > previous.temporalValue) {
						return fail(`${spy} resolved before ${spies[index - 1]}`)
					}
				}
				calls.push(call)
				return pass('order is respected')
			})
		}))
	}
}
const execution = () => {
	return (spy, transmit) => {
		return spy.firstCall().then((call) => {
			if (call) {
				transmit(call)
				return pass('executed')
			}
		})
	}
}
const expect = (...tests) => {
	let run = (transmittedValue, maxDuration = defaultMaxDuration) => {
		const compositeDetail = []
		let i = 0
		const j = tests.length
		let currentTest

		const transmit = (value) => {
			transmittedValue = value
		}
		const runTest = () => {
			const returnValue = currentTest(transmittedValue, transmit)
			return Thenable.resolve(returnValue).then(
				(value) => {
					if (value === true) {
						return pass('returned-true')
					}
					if (value === false) {
						return fail('returned-false')
					}
					if (isOutput(value)) {
						return value
					}
					return pass('resolved', value)
				},
				(reason) => {
					return fail('rejected', reason)
				}
			)
		}
		const next = () => {
			if (i === j) {
				return pass('all-passed')
			}
			currentTest = tests[i]
			i++

			return runTest().then((output) => {
				compositeDetail.push(output)
				if (output.status === 'failed') {
					return fail(`expectation failed`, compositeDetail)
				}
				return next()
			})
		}

		return terminationBefore(next)(maxDuration)
	}
	return run
}
const forward = (fn) => {
	return (value, transmit) => {
		return transmit(fn(value))
	}
}
const forwardThrow = (fn) => {
	return (value, transmit) => {
		try {
			fn(value)
			return fail('expected to throw')
		}
		catch (e) {
			transmit(e)
		}
	}
}
const forwardResolution = () => {
	return (value, transmit) => {
		return Promise.resolve(value).then(transmit)
	}
}

module.exports = expect
expect.rejection = rejection
expect.execution = execution
expect.terminationBefore = terminationBefore
// ensure.pendingAfter would be the opposite of terminationBefore
expect.sequencing = sequencing

const isString = () => {
	return (value) => {
		if (typeof value === 'string') {
			return pass('string')
		}
		return fail('not a string')
	}
}
const isFunction = () => {
	return (value) => {
		if (typeof value === 'function') {
			return pass('function')
		}
		return fail('not a function')
	}
}

// multiple expect + forwarding
{
	const usedHas10AndIsNamedDamien = expect(
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
	usedHas10AndIsNamedDamien({
		age: 10, name: 'damien'
	}).then(
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
		forward((value) => value.foo),
		isFunction(),
		forwardThrow((foo) => foo()),
		equals(10)
	)
	fooMethodThrowWith10({
		foo() {
			throw 10 // eslint-disable-line no-throw-literal
		}
	}).then(
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
		forward((value) => value.foo),
		forward((spy) => spy.firstCall()),
		forwardResolution(),
		forward((firstCall) => firstCall.args[0]),
		equals(10)
	)
	const object = {foo: spy()}
	object.foo(10)
	spyedMethodCalledWith10(object).then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
// todo: forwardRejection
// todo: pendingAfter()
// todo: settledBefore()
// todo: sequencing of spy
