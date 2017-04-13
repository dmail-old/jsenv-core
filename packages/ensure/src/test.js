/*
Inspirations :
- https://facebook.github.io/jest/docs/getting-started.html#content
- https://theintern.github.io/intern/#terminology

Notes :
- test.skip

- test.todo

*/

const timeFunction = require('./util/time-function.js')

const createAssertionError = (code, message, detail) => {
	const error = new Error()
	error.code = code
	error.name = 'AssertionError'
	error.message = message
	error.detail = detail
	return error
}
const collectAssertions = (...args) => {
	const assertions = []
	let i = 0
	const j = args.length
	while (i < j) {
		const arg = args[i]
		if (typeof arg === 'string') {
			i++
			if (i === j) {
				throw new TypeError('last arg must not be a string')
			}
			const nextArg = args[i]
			if (typeof nextArg !== 'function') {
				throw new TypeError('a string must be followed by a function')
			}
			assertions.push({
				name: arg,
				fn: nextArg
			})
		}
		else if (typeof arg === 'function') {
			assertions.push({
				name: arg.name || 'anonymous',
				fn: arg
			})
		}
		else {
			throw new TypeError('expecting string or number')
		}
		i++
	}
	return assertions
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
const test = (...args) => {
	const assertions = collectAssertions(...args)

	const run = (value) => {
		const runAll = () => {
			const getResult = (fn, value, previousResult) => {
				return timeFunction(fn)(value).then((result) => {
					if (previousResult) {
						result.duration += previousResult.duration
					}
					const returnValue = result.value
					if (typeof returnValue === 'function' && returnValue.isTest) {
						return getResult(returnValue, value, result)
					}
					return result
				})
			}
			const runAssertion = (name, fn, value, index) => {
				return getResult(fn, value).then(
					(result) => {
						const value = result.value

						if (index > 0 && value === false) {
							return createFailedReport(
								name,
								createAssertionError(
									'RESOLVED_TO_FALSE',
									`${name} assertion resolved to false`
								),
								result.duration
							)
						}

						const report = {
							duration: result.duration,
							name,
							state: 'passed',
							detail: value
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

			return Promise.resolve(value).then((value) => {
				const reports = []
				const promises = assertions.map((assertion, index) => {
					return runAssertion(
						assertion.name,
						assertion.fn,
						value,
						index + 1
					).then((report) => {
						reports.push(report)
					})
				})
				return Promise.all(promises).then(() => reports)
			})
		}

		const globalReport = {}
		return timeFunction(runAll)().then(
			(result) => {
				const reports = result.value
				const allPassed = reports.every((report) => {
					return report.state === 'passed'
				})
				globalReport.state = allPassed ? 'passed' : 'failed'
				globalReport.duration = result.duration
				globalReport.detail = reports
				return globalReport
			},
			(result) => {
				return Promise.reject(result.value)
			}
		)
	}
	run.isTest = true
	return run
}

module.exports = test
