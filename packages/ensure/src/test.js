/*
Inspirations :
- https://facebook.github.io/jest/docs/getting-started.html#content
- https://theintern.github.io/intern/#terminology

Notes :
- test.skip

- test.todo

il manque la propagation du cancel en gros
lorsque j'apelle cancel sur un test on pourrait propager le cancel à ses sous-test

*/

const ensureThenable = require('./util/ensure-thenable.js')
const timeFunction = require('./util/time-function.js')
const fail = require('./fail.js')

const isCreated = (observer) => observer.state === 'created'
const isPending = (observer) => observer.state === 'pending'
const isResolved = (observer) => observer.state === 'resolved'
const isRejected = (observer) => observer.state === 'rejected'
const isCancelled = (observer) => observer.state === 'cancelled'
const isDone = (observer) => isCreated(observer) === false && isPending(observer) === false
const monitor = (fn, observer) => {
	if (typeof observer !== 'object') {
		throw new TypeError('observer must be an object')
	}

	return function() {
		if (isCreated(observer) === false) {
			throw new Error('observer state must be created')
		}

		let resolve
		const promise = new Promise((res) => {
			resolve = res
		})
		const cancel = () => {
			if (isPending(observer)) {
				observer.state = 'cancelled'
				resolve(observer)
			}
		}
		observer.cancel = cancel
		observer.state = 'pending'
		fn.apply(this, arguments).then(
			(value) => {
				if (isPending(observer)) {
					observer.state = 'resolved'
					observer.value = value
					resolve(observer)
				}
			},
			(reason) => {
				if (isPending(observer)) {
					observer.state = 'rejected'
					observer.value = reason
					resolve(observer)
				}
			}
		)

		return promise
	}
}

const wrap = (fn, behaviour) => {
	return function(...args) {
		return behaviour.apply(this, [fn, ...args])
	}
}
const createFailedReport = (node, value, duration) => {
	const report = {
		name: node.name,
		state: 'failed',
		duration,
		detail: value
	}
	return report
}

const mark = Symbol()
const markAs = (fn, what) => {
	fn[mark] = what
}
const isPipeAssertion = (fn) => fn && fn[mark] === 'pipe'
const isSetupAssertion = (fn) => fn && fn[mark] === 'setup'
const isTestAssertion = (fn) => fn && fn[mark] === 'test'
const isNormalAssertion = (fn) => fn && mark in fn === false

const tokenize = (args) => {
	const createToken = (type, value) => {
		const token = {
			type,
			value
		}
		return token
	}
	const writeToken = (type, value) => {
		tokens.push(createToken(type, value))
	}

	const tokens = []
	let i = 0
	const j = args.length
	while (i < j) {
		const arg = args[i]
		i++
		if (typeof arg === 'string') {
			if (i === j) {
				throw new TypeError('last arg must not be a string')
			}
			if (i > 1) {
				const previousToken = tokens[i - 2]
				if (previousToken.type === 'name') {
					throw new TypeError('a string must be followed by a function')
				}
			}
			writeToken('name', arg)
		}
		else if (typeof arg === 'function') {
			if (isPipeAssertion(arg)) {
				const previousAssertionToken = tokens.find((token) => token.type === 'assertion')
				if (previousAssertionToken) {
					throw new Error('pipe cannot be preceeded by assertion')
				}
				const previousPipeToken = tokens.find((token) => token.type === 'pipe')
				if (previousPipeToken) {
					throw new Error('only one pipe allowed per test')
				}
				writeToken('pipe', arg)
			}
			else if (isSetupAssertion(arg)) {
				const previousExpectationToken = tokens.find((token) => token.type !== 'name')
				if (previousExpectationToken) {
					if (previousExpectationToken.type === 'setup') {
						throw new Error('only one setup assertion allowed per test')
					}
					throw new Error('setup must be the first expectation')
				}
				writeToken('setup', arg)
			}
			else if (isTestAssertion(arg)) {
				writeToken('test', arg)
			}
			else if (isNormalAssertion(arg)) {
				writeToken('assertion', arg)
			}
		}
		else {
			if (i > 1) {
				const previousToken = tokens[i - 2]
				if (previousToken.type === 'name') {
					throw new TypeError('a string must be followed by a function')
				}
			}
			throw new TypeError('expecting string or function')
		}
	}
	return tokens
}

const parse = (tokens) => {
	const nodes = []

	let i = 0
	const j = tokens.length
	while (i < j) {
		const token = tokens[i]
		i++

		if (token.type === 'name') {
			continue
		}

		const node = {
			type: token.type,
			value: token.value
		}
		if (i > 0) {
			const previousToken = tokens[i - 1]
			if (previousToken.type === 'name') {
				node.name = previousToken.value
			}
			else if (token.value.name) {
				node.name = token.value.name
			}
		}
		nodes.push(node)
	}

	return nodes
}

const transform = () => {}

const reportAssertion = (fn, node) => {
	return function() {
		return fn.apply(this, arguments).then(
			(result) => {
				const report = {
					name: node.name,
					state: 'passed',
					duration: result.duration,
					detail: result.value
				}
				return report
			},
			(result) => {
				const value = result.value
				if (value && value.name === 'AssertionError') {
					return createFailedReport(node, value, result.duration)
				}
				return Promise.reject(value)
			}
		)
	}
}
const reportPipe = reportAssertion
const reportAfterAssertion = (fn, node) => {
	return function() {
		return fn.apply(this, arguments).then(
			(result) => {
				const report = {
					name: `after: ${node.name}`,
					state: 'passed',
					duration: result.duration,
					detail: result.value
				}
				return report
			},
			(result) => Promise.reject(result.value)
		)
	}
}
const reportTest = (fn, node) => {
	return function() {
		return fn.apply(this, arguments).then(
			(result) => {
				const {duration} = result
				const observer = result.value
				const observers = observer.value
				const someIsCancelled = observers.some(isCancelled)
				if (someIsCancelled) {
					const report = {
						name: node ? node.name : undefined,
						state: 'cancelled',
						duration,
						detail: reports
					}
					return report
				}

				const reports = observers.map((observer) => observer.value)
				const allPassed = reports.every((report) => report.state === 'passed')
				const report = {
					name: node ? node.name : undefined,
					state: allPassed ? 'passed' : 'failed',
					duration,
					detail: reports
				}

				return report
			},
			(result) => Promise.reject(result.value)
		)
	}
}
const reportBeforeTest = reportAssertion
const reportAfterTest = reportAssertion

const runners = {
	'assertion'(node) {
		const {value} = node
		let fn = value
		fn = ensureThenable(value, (returnValue) => {
			if (returnValue && isTestAssertion(returnValue)) {
				const error = new Error('malformed test: assertion cannot return test')
				error.code = 'CANNOT_RETURN_TEST_IN_ASSERTION'
				throw error
			}
			return returnValue
		})
		fn = wrap(fn, (fn, context) => {
			const {after} = context
			context.after = (fn) => {
				fn = ensureThenable(fn)
				fn = timeFunction(fn)
				fn = reportAfterAssertion(fn, node)
				after(fn)
			}
			return fn(context.value, context).then(
				(value) => {
					if (value === false) {
						throw fail({
							code: 'RESOLVED_TO_FALSE',
							message: `${node.name} assertion resolved to false`
						})
					}
					return value
				}
			)
		})
		fn = timeFunction(fn)
		fn = reportAssertion(fn, node)

		return {
			run: fn,
			supportConcurrency: true
		}
	},
	'pipe'(node) {
		const {value} = node.value
		let fn = value
		fn = ensureThenable(value)
		fn = wrap(fn, (fn, context) => {
			return fn(context.value, context).then(
				(value) => {
					context.value = value
				}
			)
		})
		fn = timeFunction(fn)
		fn = reportPipe(fn, node)

		return {
			run: fn,
			supportConcurrency: false
		}
	},
	'test'(node) {
		const {value} = node.value
		let fn = value

		return {
			run: fn,
			supportConcurrency: true
		}
	},
	'setup'(node) {
		const {value} = node
		let fn = value
		fn = ensureThenable(value)
		fn = wrap(fn, (fn, context) => {
			return fn(context.value, context).then((value) => {
				if (typeof value === 'function') {
					let fn = ensureThenable(fn)
					fn = timeFunction(fn)
					fn = reportAfterTest(fn, node)
					context.afterAll(fn)
				}
			})
		})
		fn = timeFunction(fn)
		fn = reportBeforeTest(fn, node)

		return {
			run: fn,
			supportConcurrency: false
		}
	}
}
const createRunner = (node) => {
	const {type} = node
	if (type in runners) {
		const runner = runners[type](node)
		return runner
	}
	throw new Error(`no runner for ${type}`)
}
const execAndMonitor = (fn, observer, context) => {
	return monitor(fn, observer)(context)
}
const execAndMonitorAll = (runners, context) => {
	const compositeObserver = {state: 'created'}

	return monitor((context) => {
		const observers = []
		const addObserver = function() {
			const observer = {state: 'created'}
			observers.push(observer)
			return observer
		}
		const assertionObservers = runners.map(() => addObserver())

		return new Promise((resolve) => {
			let assertionStartedCount = 0

			const done = () => {
				resolve(observers)
			}
			const checkDone = () => {
				if (observers.every(isDone)) {
					done()
				}
			}
			const cancelRemaining = () => {
				const pendingObservers = assertionObservers.filter(isPending)
				pendingObservers.forEach((observer) => observer.cancel())
			}
			const next = () => {
				if (assertionStartedCount < assertionObservers.length) {
					const runner = runners[assertionStartedCount]
					const observer = assertionObservers[assertionStartedCount]
					assertionStartedCount++

					const runnerContext = Object.assign({}, context)
					// runnerContext.afterAll = (fn) => {
					// 	afterAll = fn
					// }
					runnerContext.after = (fn) => {
						runner.after = fn
					}

					execAndMonitor(runner.run, observer, runnerContext).then(
						() => {
							if (isCancelled(observer)) {
								// noop
							}
							else if (isResolved(observer)) {
								next()
							}
							else if (isRejected(observer)) {
								cancelRemaining()
							}

							if (runner.after) {
								execAndMonitor(runner.after, addObserver(), context).then(checkDone)
							}
							else {
								checkDone()
							}
						}
					)
					if (runner.supportConcurrency) {
						next()
					}
				}
			}
			next()
		})
	}, compositeObserver)(context)
}
const generate = (nodes) => {
	const runners = nodes.map(createRunner)
	let fn = (context) => {
		return Promise.resolve(context.value).then((value) => {
			context.value = value
			return execAndMonitorAll(runners, context).then((observer) => {
				if (observer.state === 'rejected') {
					return Promise.reject(observer.value)
				}
				return observer
			})
		})
	}
	fn = timeFunction(fn)
	fn = reportTest(fn)
	const run = (options = {}) => {
		const context = {
			options,
			value: options.value,
		}
		return fn(context)
	}
	markAs(run, 'test')
	return run
}
const compile = (args) => {
	const tokens = tokenize(args)
	const nodes = parse(tokens)
	transform(nodes)
	const run = generate(nodes)
	return {
		nodes,
		output: run
	}
}

const test = (...args) => {
	const result = compile(args)
	const {output} = result
	output.nodes = result.nodes
	return output
}

module.exports = test
