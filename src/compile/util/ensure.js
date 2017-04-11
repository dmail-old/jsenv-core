/*
https://theintern.github.io/intern/#terminology
https://facebook.github.io/jest/docs/getting-started.html#content
*/
const spy = require('./spy.js')
const ensureThenable = require('./ensure-thenable.js')

const defaultMaxDuration = 1000 * 3
const Thenable = Promise

const resolveBefore = (fn, ms) => {
	fn = ensureThenable(fn)
	function ensureResolvingBefore(context) {
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
	return ensureResolvingBefore
}
// ensure.pendingAfter would be the opposite of resolveBefore

const createContext = ({value, output, maxDuration} = {}) => {
	output = output || {
		status: 'pending'
	}

	const context = {
		value,
		output,
		maxDuration,
	}
	context.pass = (reason, detail) => {
		if (output.status === 'pending') {
			Object.assign(output, {
				status: 'passed',
				reason,
				detail,
			})
		}
	}
	context.fail = (reason, detail) => {
		if (output.status === 'pending') {
			Object.assign(output, {
				status: 'failed',
				reason,
				detail,
			})
		}
	}
	return context
}
const nextContext = (context) => {
	const next = createContext({
		value: context.value
	})
	next.previous = context
	return next
}
const expect = (...tests) => {
	let run = (context = createContext({
		maxDuration: defaultMaxDuration
	})) => {
		let i = 0
		const j = tests.length
		let currentTest
		let currentContext = context

		const runTest = () => {
			const output = currentContext.output
			const returnValue = currentTest(currentContext)
			return Thenable.resolve(returnValue).then(
				(value) => {
					if (value === currentContext) {
						// something special if we return the context?
						// je sais pas trop mais en tous cas il faut un truc genre composeContext
						// pour qu'on puisse composer le résultat de deux expect()
					}
					if (output.status === 'pending') {
						if (value === true) {
							currentContext.pass('resolved-to-true')
						}
						else if (value === false) {
							currentContext.fail('resolved-to-false')
						}
						else {
							currentContext.pass('resolved', value)
						}
					}
				},
				(reason) => {
					currentContext.fail('rejected', reason)
				}
			)
		}
		const next = () => {
			if (i === j) {
				context.pass('all-passed', currentContext)
				return context
			}
			currentTest = tests[i]
			i++

			currentContext = nextContext(currentContext)
			return runTest().then(() => {
				if (currentContext.output.status === 'failed') {
					context.fail('last-content-failed')
					return context
				}
				return next()
			})
		}

		const {maxDuration} = context
		if (maxDuration) {
			return resolveBefore(next, maxDuration)(context)
		}
		return next()
	}
	return run
}
module.exports = expect

expect.resolveBefore = resolveBefore
const forward = (fn = (v) => v) => {
	return (context) => {
		return Promise.resolve(fn(context.value)).then((value) => {
			context.value = value
		})
	}
}
expect.forward = forward
const forwardSync = (fn = (v) => v) => {
	return (context) => {
		context.value = fn(context.value)
	}
}
expect.forwardSync = forwardSync
const forwardException = (fn) => {
	return (context) => {
		if (fn) {
			const then = fn.then
			if (then === 'function') {
				return then.call(fn,
					(value) => {
						context.fail('expected to reject', value)
					},
					(reason) => {
						context.value = reason
					}
				)
			}
			if (typeof fn === 'function') {
				try {
					fn(context.value)
					context.fail('expected to throw')
				}
				catch (e) {
					context.value = e
				}
			}
		}
	}
}
expect.forwardException = forwardException
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

const equals = (expectedValue) => {
	return ({value, pass, fail}) => {
		if (value === expectedValue) {
			return pass('equals')
		}
		return fail('value does not equal', expectedValue)
	}
}
expect.equals = equals
const isString = () => {
	return ({value, pass, fail}) => {
		if (typeof value === 'string') {
			return pass('string')
		}
		return fail('not a string')
	}
}
expect.isString = isString
const isFunction = () => {
	return ({value, pass, fail}) => {
		if (typeof value === 'function') {
			return pass('function')
		}
		return fail('not a function')
	}
}
expect.isFunction = isFunction
expect.spy = spy
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

const test = 1

{
	const unit = test('age is 10 and name is damien', () => {
		return expect({age: 10, name: 'damien'}).branch(
			(expectation) => expectation.at('age').equals(10),
			(expectation) => expectation.at('damien').equals('damien').isString()
		)
	})
	unit().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
{
	const unit = test('foo method throw with 10', () => {
		return expect({
			foo() {
				throw 10 // eslint-disable-line no-throw-literal
			}
		}).at('foo').isFunction().atException((value) => value()).equals(10)
	})
	unit().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}
{
	const unit = test('spy is called with 5 as first arg', () => {
		const object = {foo: spy()}
		object.foo(5)
		return expect(object).at('foo').at((foo) => foo.firstCall()).at('args').at(0).equals(5)
	})
	unit().then(
		(output) => {
			console.log('test output', output)
		},
		(reason) => {
			console.log('unexpected test error', reason)
		}
	)
}

const sameValues = require('./same-values.js')

const transpile = (strings, ...values) => {
	const raw = strings.reduce((memo, string, index) => {
		return memo + values[index] + string
	}, '')
	return eval(raw)
}
{
	const suite = test('function parameters', () => {
		test('default', () => {
			test('base', () => {
				return expect(
					transpile`(function(defaultA, defaultB) {
						return function(a = defaultA, b = defaultB) {
							return [a, b]
						}
					})`
				).all(
					'use default with a missing argument',
					(fn) => {
						const defaultA = 1
						const defaultB = 2
						const a = 3
						const result = fn(defaultA, defaultB)(a)
						return sameValues(result, [a, defaultB])
					},
					'use default with an explicit undefined argument',
					(fn) => {
						const defaultA = 1
						const defaultB = 2
						const b = 4
						const result = fn(defaultA, defaultB)(undefined, b)
						return sameValues(result, [defaultA, b])
					}
				)
			})
			test('does not mutate arguments', () => {
				return expect(
					transpile`(function(defaultValue) {
						return function(a = defaultValue) {
							a = 10
							return arguments
						}
					})`
				).branch(
					(fn) => {
						const defaultValue = 1
						const value = 2
						const result = fn(defaultValue)(value)
						return sameValues(result, [value])
					}
				)
			})
			test('can refer to previous arguments', () => {
				return expect(
					transpile`(function(defaultValue) {
						return function(a = defaultValue, b = a) {
							return [a, b]
						}
					})`
				).branch(
					(fn) => {
						const defaultValue = 1
						const result = fn(defaultValue)()
						return sameValues(result, [defaultValue, defaultValue])
					}
				)
			})
		})
		test('rest', () => {
			test('base', () => {
				return expect(
					transpile`(function(foo, ...rest) {
						return [foo, rest];
					})`
				).branch(
					(fn) => {
						const first = 1
						const second = 2
						const result = fn(first, second)
						return (
							result[0] === first &&
							sameValues(result[1], [second])
						)
					}
				)
			})
			test('does not count in function length', () => {
				return expect(
					transpile`(function() {
						return [
							function(a, ...b) {},
							function(...c) {}
						]
					})`
				).branch(
					(fn) => {
						const result = fn()
						return (
							result[0].length === 1 &&
							result[1].length === 0
						)
					}
				)
			})
		})
		test('destructuring', () => {
			test('array-notation', () => {
				return expect(
					transpile`(function([a]) {
						return a
					})`
				).branch(
					(fn) => {
						const value = 1
						const result = fn([value])
						return result === value
					},
					(fn) => fn.length === 1
				)
			})
			test('object-notation', () => {
				return expect(
					transpile`(function({a}) {
						return a
					})`
				).branch(
					(fn) => {
						const value = 1
						const result = fn({a: value})
						return result === value
					},
					(fn) => fn.length === 1
				)
			})
		})
	})
	console.log(suite)
}

{
	const suite = test('exclude is called and exclude the corresponding ressource', () => {
		const exclude = spy(() => true)

		return expect(
			System.import('parse').then((parse) => {
				return Promise.all([
					parse(`./main.js`, __dirname),
					System.import('transform')
				])
			}).then(([tree, transform]) => {
				return transform(tree, {
					exclude,
				})
			})
		).all(
			() => expect(exclude).calledWith('file.js', 'main.js'),
			(expectation) => expectation.at((v) => v.root.ressources[0].excluded).isTrue()
		)
	})
	console.log(suite)
}

// todo: pendingAfter()
// todo: resolveBefore()
// todo: forwardRejection
// todo: sequencing of spy
