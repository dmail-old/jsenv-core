/*
Inspirations :
- https://facebook.github.io/jest/docs/getting-started.html#content
- https://theintern.github.io/intern/#terminology

Notes :
- test.skip

- test.todo

*/

const ensureThenable = require('./util/ensure-thenable.js')
const timeFunction = require('./util/time-function.js')

const createAssertionError = (code, message, detail) => {
	const error = new Error()
	error.code = code
	error.name = 'AssertionError'
	error.message = message
	error.detail = detail
	return error
}
const createFailedReport = (duration, name, value) => {
	const report = {
		name,
		state: 'failed',
		duration,
		detail: value
	}
	return report
}

const isPipeAssertion = () => {
	return false
}
const isSetupAssertion = () => {
	return false
}
const isTestAssertion = () => {
	return false
}
const isNormalAssertion = () => {
	return true
}
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

const runners = {
	'assertion'(node) {
		const fn = ensureThenable(node.value)

		return {
			run: (context) => fn(context.value, context, (fn) => {
				fn = timeFunction(fn)
				fn = reportCancel(fn, node)
				context.cancel(fn)
			}).then(
				(value) => {
					if (value === false) {
						throw createAssertionError(
							'RESOLVED_TO_FALSE',
							`${name} assertion resolved to false`
						)
					}
					return value
				}
			),
			supportConcurrency: true
		}
	},
	'pipe'(node) {
		const fn = ensureThenable(node.value)

		return {
			run: (context) => fn(context.value, context).then(
				(value) => {
					context.value = value
				}
			),
			supportConcurrency: false
		}
	},
	'test'(node) {
		const {value} = node.value
		// here value is the function returned by a test() call
		return {
			run: value,
			supportConcurrency: true
		}
	},
	'setup'(node) {
		const {value} = node
		const setup = ensureThenable(value)
		return {
			run: (context) => {
				return setup(context.value, context).then((value) => {
					if (typeof value === 'function') {
						// we want to time & get a report from teardown as well
						let fn = value
						fn = timeFunction(fn)
						fn = reportTeardown(fn, node)
						context.teardown(fn)
					}
				})
			},
			supportConcurrency: false
		}
	}
}
const reportTest = (fn) => {
	return (...args) => {
		return fn.apply(this, args).then(
			(result) => {
				const {duration} = result
				const reports = result.value
				const allPassed = reports.every((report) => report.state === 'passed')
				const report = {
					state: allPassed ? 'passed' : 'failed',
					duration,
					detail: reports,
				}
				return report
			},
			(result) => Promise.reject(result.value)
		)
	}
}
const reportExpectation = (fn, node) => {
	return (...args) => {
		return fn.apply(this, args).then(
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
					return createFailedReport(name, value, result.duration)
				}
				return Promise.reject(value)
			}
		)
	}
}
const reportCancel = (fn, node) => {
	return (...args) => {
		return fn.apply(this, args).then(
			(result) => {
				const report = {
					name: `cancel: ${node.name}`,
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
const reportTeardown = (fn, node) => {
	return (...args) => {
		return fn.apply(this, args).then(
			(result) => {
				const report = {
					name: `teardown: ${node.name}`,
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
const createRunner = (node) => {
	const {type} = node
	if (type in runners) {
		const runner = runners[type](node)
		runner.run = timeFunction(runner.run)
		runner.run = reportExpectation(runner.run, node)
		return runner
	}
	throw new Error(`no runner for ${type}`)
}
const execAndMonitorAll = (runners, context) => {
	const globalResult = {
		state: 'created',
		results: []
	}
	const {results} = globalResult
	const addResult = () => {
		const result = {state: 'created'}
		results.push(result)
		return result
	}
	runners.forEach(() => addResult())
	const monitor = (fn, result) => {
		result.state = 'pending'
		return function() {
			return fn.apply(this, arguments).then(
				(value) => {
					result.state = 'resolved'
					result.value = value
					return result
				},
				(reason) => {
					result.state = 'rejected'
					result.value = reason
					return result
				}
			)
		}
	}
	const execAndMonitor = (fn, result, context) => {
		return monitor(fn, result)(context)
	}

	return new Promise((resolve) => {
		let startedCount = 0
		let doneCount = 0

		let teardown
		const registerTeardown = (fn) => {
			teardown = fn
		}
		const done = () => {
			const pendingRunners = runners.filter((runner, index) => {
				return results[index].state === 'pending'
			})
			const pendingRunnersWithCancel = pendingRunners.filter((runner) => {
				return typeof runner.cancel === 'function'
			})
			return Promise.all(pendingRunnersWithCancel.map(
				(runner) => execAndMonitor(runner.cancel, addResult(), context)
			)).then(
				() => {
					if (teardown) {
						return execAndMonitor(teardown, addResult(), context)
					}
				}
			).then(
				() => {
					const rejectedResults = results.filter((result) => result.state === 'rejected')
					if (rejectedResults.length > 0) {
						globalResult.state = 'rejected'
						globalResult.value = rejectedResults[0].value
						if (rejectedResults.length > 1) {
							console.warn('More than one result has rejected, you can check the report')
						}
					}
					else {
						const resolvedResults = results.filter((result) => result.state === 'resolved')
						if (resolvedResults.length < results.length) {
							throw new Error('done expect all result to be resolved')
						}
						globalResult.state = 'resolved'
					}
					resolve(globalResult)
				}
			)
		}
		const next = () => {
			if (startedCount < runners.length) {
				const runner = runners[startedCount]
				const result = results[startedCount]
				startedCount++
				// selon le runner c'est soit register teardown
				// soit register cancel
				// y a t-il une diff en teardown et cancel ???
				// oui une: teardown est toujours appelé alors que cancel
				// qui si encore running

				const runnerContext = Object.assign({}, context)
				runnerContext.teardown = registerTeardown
				runnerContext.cancel = (fn) => {
					runner.cancel = fn
				}

				execAndMonitor(runner.run, result, runnerContext).then(
					() => {
						if (result.state === 'resolved') {
							doneCount++
							if (doneCount === runners.length) {
								done()
							}
							else {
								next()
							}
						}
						else if (result.state === 'rejected') {
							done()
						}
					}
				)
				if (runner.supportConcurrency) {
					next()
				}
			}
		}

		globalResult.state = 'pending'
		next()
	}).then(() => globalResult)
}
const generate = (nodes) => {
	const runners = nodes.map(createRunner)
	const testRunner = (context) => {
		return Promise.resolve(context.value).then((value) => {
			context.value = value
			return execAndMonitorAll(runners, context).then((result) => {
				if (result.state === 'rejected') {
					return Promise.reject(result.value)
				}
				return result.results.map((localResult) => localResult.value)
			})
		})
	}
	const testRunnerWithTime = timeFunction(testRunner)
	const testRunnerWithReport = reportTest(testRunnerWithTime)
	const run = (options = {}) => {
		const context = {
			options,
			value: options.value,
		}
		return testRunnerWithReport(context)
	}

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
