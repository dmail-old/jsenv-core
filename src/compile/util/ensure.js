/* eslint-disable max-nested-callbacks */
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

const assert = (value, fn) => {
	return new Promise((resolve, reject) => {
		const returnValue = fn(value)
		if (returnValue === true) {
			resolve('returned-true')
		}
		if (returnValue === false) {
			reject('returned-false')
		}
		resolve(returnValue)
	})
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
const expectRejection = 1

{
	const unit = test('age is 10 and name is damien', () => {
		return expect(
			{age: 10, name: 'damien'},
			(user) => expect(
				user.age,
				(age) => equals(age, 10)
			),
			(user) => expect(
				user.name,
				(name) => equals(name, 'damien'),
				(name) => isString(name)
			)
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

	/*
	pourrait y avoir un helper genre
	expect(
		{name: 'dam'},
		property(
			'dam',
			(dam) => true
		)
	)
	*/

}
{
	const unit = test('foo method throw with 10', () => {
		return expect(
			{
				foo() {
					throw 10 // eslint-disable-line no-throw-literal
				}
			},
			(object) => expect(
				object.foo,
				(foo) => isFunction(foo),
				(foo) => expectRejection(
					foo(),
					(error) => equals(error, 10)
				)
			)
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
	const unit = test('spy is called with 5 as first arg', () => {
		const object = {foo: spy()}
		object.foo(5)
		return expect(
			object,
			(object) => expect(
				object.foo,
				(foo) => expect(
					foo.firstCall(),
					(firstCall) => expect(
						firstCall.args,
						(args) => expect(
							args[0],
							(firstArg) => equals(firstArg, 5)
						)
					)
				)
			)
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
					})`,
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
					})`,
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
					})`,
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
					})`,
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
					})`,
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
					})`,
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
					})`,
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
			}),
			() => expect(
				exclude,
				(v) => calledWith(v, 'file.js', 'main.js')
			),
			(tree) => expect(
				tree.root.ressources[0].excluded,
				(excluded) => equals(excluded, true)
			)
		)
	})
	console.log(suite)
}

// todo: pendingAfter()
// todo: resolveBefore()
// todo: forwardRejection
// todo: sequencing of spy
