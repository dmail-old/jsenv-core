const ensureThenable = 1

const defaultMaxDuration = 100
const Thenable = Promise
const Output = 1
const fail = 1
const pass = 1
// const spy = 1

const before = (fn, ms) => {
	fn = ensureThenable(fn)
	return () => {
		let id
		return Thenable.race([
			fn,
			new Thenable(function(resolve) {
				id = setTimeout(function() {
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
}
const reject = (fn) => {
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
const at = (fn) => {
	return (value, transmit) => transmit(fn(value))
}
const order = (...spies) => {
	return () => {
		const calls = []
		return Promise.all(spies.map((spy, index) => {
			return spy.then((call) => {
				if (index > 0) {
					const previous = calls[index - 1]
					if (call.id > previous.id) {
						return fail(`${spy} resolved before ${spies[index - 1]}`)
					}
				}
				calls.push(call)
				return pass('order is respected')
			})
		}))
	}
}
const called = () => {
	return (spy) => {
		if (spy.calls.length < 0) {
			return fail('not called')
		}
		return pass('called')
	}
}

const ensure = (namedTests, {
	maxDuration = defaultMaxDuration,
} = {}) => {
	const tests = Object.keys(namedTests).map((testName) => {
		return {
			name: testName,
			test: namedTests[testName]
		}
	})

	const run = () => {
		const compositeDetail = {}
		let i = 0
		const j = tests.length
		let transmittedValue
		let currentTest

		const transmit = (value) => {
			transmittedValue = value
		}
		function next() {
			if (i === j) {
				return pass('all-passed')
			}
			currentTest = tests[i]
			i++

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
						if (Output.is(value)) {
							return value
						}
						return pass('resolved', value)
					},
					(reason) => {
						return fail('rejected', reason)
					}
				)
			}

			return before(runTest, maxDuration)().then((output) => {
				compositeDetail[currentTest.name] = output
				if (output.status === 'failed') {
					return fail(`expectation failed: ${currentTest.name}`, compositeDetail)
				}
				return next()
			})
		}

		return next()
	}

	return run
}

module.exports = ensure
ensure.at = at
ensure.reject = reject
ensure.called = called
ensure.before = before
// ensure.timeout would be the opposite of before
ensure.order = order
