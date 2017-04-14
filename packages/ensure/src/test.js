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
			run: (options) => fn(options.value, options).then(
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
			run: (options) => fn(options.value, options).then(
				(value) => {
					options.value = value
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
			run: (options, registerTeardown) => {
				return setup(options.value).then((value) => {
					if (typeof value === 'function') {
						// we want to time & get a report from teardown as well
						value = timeFunction(value)
						value = reportExpectation(value, node.name)
						registerTeardown(value)
					}
				})
			},
			supportConcurrency: false
		}
	}
}
const reportExpectation = (fn, name) => {
	return (...args) => {
		return fn.apply(this, args).then(
			(result) => {
				const report = {
					duration: result.duration,
					name,
					state: 'passed',
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
const reportTest = (fn) => {
	return (...args) => {
		return fn.apply(this, args).then(
			(result) => {
				const {duration} = result
				const reports = result.value
				const allPassed = reports.every((report) => {
					return report.state === 'passed'
				})
				const report = {
					state: allPassed ? 'passed' : 'failed',
					duration,
					detail: reports,
				}
				return report
			},
			(result) => {
				return Promise.reject(result.value)
			}
		)
	}
}
const createRunner = (node) => {
	const {type} = node
	if (type in runners) {
		const runner = runners[type](node)
		runner.run = timeFunction(runner.run)
		runner.run = reportExpectation(runner.run)
		return runner
	}
	throw new Error(`no runner for ${type}`)
}
// there is a problem here: teardown cannot change
// globalResult state if its considered resolved
// we have to change all this a bit
// in short execAndMonitor should not behave the same for teardown
const execAndMonitorAll = (runners, options) => {
	const globalResult = {
		state: 'created',
		results: runners.map(() => {
			return {
				state: 'created'
			}
		})
	}

	return new Promise((resolve, reject) => {
		let startedCount = 0
		let doneCount = 0
		const {results} = globalResult
		let teardown = () => Promise.resolve()
		const registerTeardown = (fn) => {
			teardown = fn
		}

		const execAndMonitor = (fn, result) => {
			result.state = 'pending'
			return fn(options, registerTeardown).then(
				(value) => {
					if (globalResult.state === 'pending') {
						result.state = 'resolved'
						result.value = value
						doneCount++
						next()
					}
				},
				(reason) => {
					if (globalResult.state === 'pending') {
						result.state = 'rejected'
						result.value = reason
						globalResult.state = 'rejected'
						globalResult.value = reason
						done()
					}
					else if (globalResult.state === 'rejected') {
						// an error occured inside the teardown
						// let's just ignore that error for now
					}
				}
			)
		}
		const done = () => {
			let donePromise

			if (globalResult.state === 'rejected') {
				const pendingRunners = runners.filter((runner, index) => {
					return results[index].state === 'pending'
				})
				const pendingRunnersWithCancel = pendingRunners.filter((runner) => {
					return typeof runner.cancel === 'function'
				})
				donePromise = Promise.all(
					pendingRunnersWithCancel.map((runner) => runner.cancel())
				)
			}
			else {
				globalResult.state = 'resolved'
				donePromise = Promise.resolve()
			}

			donePromise.then(() => {
				const teardownResult = {
					state: 'created'
				}
				results.push(teardownResult)
				return execAndMonitor(teardown, teardownResult)
			}).then(resolve, reject)
		}
		const next = () => {
			if (doneCount === runners.length) {
				done()
			}
			else if (startedCount < runners.length) {
				const runner = runners[startedCount]
				const result = results[startedCount]
				startedCount++
				execAndMonitor(runner.run, result)
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
	const testRunner = (options) => {
		return Promise.resolve(options.value).then((value) => {
			options.value = value
			return execAndMonitorAll(runners, options).then((result) => {
				if (result.state === 'rejected') {
					return Promise.reject(result.value)
				}
				return result.results.map((localResult) => localResult.value)
			})
		})
	}
	const testRunnerWithTime = timeFunction(testRunner)
	const testRunnerWithReport = reportTest(testRunnerWithTime)
	const run = (options = {}) => testRunnerWithReport(options)

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
