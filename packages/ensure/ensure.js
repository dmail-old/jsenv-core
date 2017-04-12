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
			if (i < j) {
				assertions.push({
					name: arg,
					fn: args[i]
				})
			}
		}
		else {
			assertions.push({
				name: arg.name || 'anonymous',
				fn: arg
			})
		}
		i++
	}
	return assertions
}
const test = (name, producer, ...args) => {
	if (typeof name !== 'string') {
		throw new TypeError('test first arg must be a number')
	}
	if (typeof producer !== 'function') {
		throw new TypeError('test second arg must be a function')
	}
	const assertions = collectAssertions(...args)

	const run = (initialValue) => {
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
							console.log(name, 'resolved to false')
							throw createAssertionError(
								'RESOLVED_TO_FALSE',
								`${name} assertion resolved to false`
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
							const report = {
								duration: result.duration,
								name,
								state: 'failed',
								detail: value
							}
							return report
						}
						return Promise.reject(value)
					}
				)
			}

			const reports = []
			return runAssertion(name, producer, initialValue, 0).then((producerReport) => {
				reports.push(producerReport)
				const value = producerReport.detail
				const promises = assertions.map((assertion, index) => {
					return runAssertion(
						assertion.name,
						assertion.fn,
						value,
						index + 1
					)
				})
				return Promise.all(promises).then((assertionReports) => {
					reports.push(...assertionReports)
				})
			}).then(() => reports)
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
const isString = (value) => {
	return typeof value === 'string'
}

/*
Inspirations :
- https://facebook.github.io/jest/docs/getting-started.html#content
- https://theintern.github.io/intern/#terminology

Notes :
- avoir un rapport de résultat plus précis que all-passed
all-passed c'est cool pour le moment et c'est ce qu'on veut savoir
de manière absolue
mais savoir combien de test ont été run, en combien de temps
combien d'assertion, lesquelles etc ce serais pas du luxe

https://github.com/jsenv/core/tree/without-rollup/src/features/performance/now

- tester & gérer le timeout
en gros il faut pouvoir avoir un timeout global pour qu'un test
fail s'il ne se résoud pas dans un laps de temps imparti
il faudra pouvoir override ce timeout globallement et localement

- test.catch
la fonction qui génère ce qu'on test doit throw ou reject
sinon on c'est une assertionError, de plus la valeur qui est throw/reject
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
const suite = test(
	'generate user',
	() => ({age: 10, name: 'damien'}),
	'ensure age is 10',
	(user) => test(
		'age',
		() => user.age,
		'is 10',
		(age) => equals(age, 10)
	),
	'ensure name is damien & is as string',
	(user) => test(
		'name',
		() => user.name,
		'is damien',
		(name) => equals(name, 'damien'),
		'is a string',
		(name) => isString(name)
	)
)
suite().then(
	(value) => {
		console.log('test result', value)
	},
	(reason) => {
		console.log('unexpected test error', reason)
	}
)
