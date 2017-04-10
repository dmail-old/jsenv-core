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

const terminationBefore = (fn, ms) => {
	fn = ensureThenable(fn)
	function ensureTerminatedBefore() {
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
const ensure = (produce, namedTests, {
	maxDuration = defaultMaxDuration,
} = {}) => {
	produce = ensureThenable(produce)
	const tests = Object.keys(namedTests).map((name) => {
		return {
			name,
			test: namedTests[name]
		}
	})

	let run = (...args) => {
		const compositeDetail = {}
		let i = 0
		const j = tests.length
		let currentTest
		let transmittedValue

		const transmit = (value) => {
			transmittedValue = value
		}
		const runTest = () => {
			const returnValue = currentTest.test(transmittedValue, transmit)
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
				compositeDetail[currentTest.name] = output
				if (output.status === 'failed') {
					return fail(`expectation failed: ${currentTest.name}`, compositeDetail)
				}
				return next()
			})
		}
		const start = () => {
			return produce(...args).then((value) => {
				transmit(value)
				return next()
			})
		}

		return start()
	}
	run = terminationBefore(run, maxDuration)

	return run
}

module.exports = ensure
ensure.rejection = rejection
ensure.execution = execution
ensure.terminationBefore = terminationBefore
// ensure.pendingAfter would be the opposite of terminationBefore
ensure.sequencing = sequencing

{
	/*
	voir si y'aurais pas une meilleur api

	je sais pas ptet

const usedHas10AndIsNamedDamien = expect(
	{age: 10, name: 'damien'},
	expect(
		(value) => value.age,
		equals(10)
	),
	expect(
		(value) => value.name,
		equals('damien'),
		isString()
	)
)

const spyIsCalledWith10AsFirstArg = expect(
	spy(),
	expect(
		(value) => spy.firstCall()
		expect(
			(call) => call.args[0],
			equals(10)
		)
	)
)

const spySequencing = expect(
	() => [spy(), spy(), spy()],
	(spies) => {
			return sequencing(spies)(
				...Promise.all(spies.map((spy) => spy.firstCall())
			)
		}
	)
)

elle est cool cet api, l'avantage c'est que c'est très lisible

*/

	const test = ensure(
		() => {
			const method = spy()
			method('foo')
			return {
				value: Promise.resolve(10),
				method,
			}
		},
		{
			'value property thenable resolution': ensure(
				(v) => v.value,
				{
					'is 10': equals(10)
				}
			),
			'method': ensure(
				(v) => v.method,
				{
					'called': execution(),
					'args': (call) => {
						if (call.args[0] !== 'foo') {
							return fail('first arg is not foo')
						}
						return pass('first arg is foo')
					}
				}
			)
		}
	)
	test().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
{
	const test = ensure(
		() => {
			return [
				spy(),
				spy(),
				spy()
			]
		},
		{
			'call them': (spies) => {
				spies.forEach((spy) => spy())
			},
			'sequencing': (spies) => {
				return sequencing(...spies)()
			}
		}
	)
	test().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
