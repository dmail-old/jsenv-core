/*
Inspirations :
- https://facebook.github.io/jest/docs/getting-started.html#content
- https://theintern.github.io/intern/#terminology

Notes :
- test.setup
pouvoir setup un test, par ex
test.setup(
	() => {
		const server = http.createServer()
		return server.open().then(() => {
			return () => server.close()
		})
	},
	...assertions
)
cela signifique démarre un serveur pendent ce test et arrête le à la fin

plusieurs choses : en cas d'erreur il faut appeler le teardown
à la fin des tests il faut aussi appeler le teardown
vu qu'on utilise Promise.all() pour run les assertions
il faut que si une assertion throw et que d'autre assertions sont encore en cours
de réalisation on apelle aussi le teardown

on va en permier écrire les tests puis faire l'implémentation

- tester & gérer le timeout
en gros il faut pouvoir avoir un timeout global pour qu'un test
fail s'il ne se résoud pas dans un laps de temps imparti
il faudra pouvoir override ce timeout globallement et localement

- test.catch
la fonction qui génère ce qu'on test doit throw ou reject
sinon c'est une assertionError, de plus la valeur qui est throw/reject
devient ce qu'on teste

- test.sync
la valeur produite par producer n'est pas resolve
une promesse reste non-résolue
pour la résoudre par la suite faudra écrire
(thenable) => test(
	'resolution value',
	() => thenable,
	(value) => value === 1
)

- test.skip

- test.todo

*/

const timeFunction = require('./time-function.js')

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

const equals = (value, expectedValue) => {
	return value === expectedValue
}
test.equals = equals
const isString = (value) => {
	return typeof value === 'string'
}
test.isString = isString

module.exports = test
