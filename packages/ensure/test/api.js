/*
- tester le rapport de résultat (il doit bien contenir le report de tous les tests)
vérifier que les assertions sont run en parallèle
-> comment fait-on si une assertion A throw et B était run en parallèle MAIS B avait set un timeout
ou un truc du genre ? il faudrait que B puisse unset son timeout ou quoi sinon
le script ne rend pas la main
*/

module.exports = (test, assert) => {
	assert.equal(typeof test, 'function')
	assert.throws(() => test(''), (e) => e.message === 'last arg must not be a string')
	assert.throws(() => test('', true), (e) => e.message === 'a string must be followed by a function')
	assert.equal(typeof test('', () => 1), 'function')

	const asyncTests = {
		'assertion called with first test arg'() {
			let assertionArgs
			const value = 10
			return test(
				(...args) => {
					assertionArgs = args
				}
			)(value).then(() => {
				assert.equal(assertionArgs[0], value)
			})
		},
		'assertion returning false means failed'() {
			return test(
				() => false
			)().then((report) => {
				assert.equal(report.state, 'failed')
			})
		}
	}

	return Object.keys(asyncTests).reduce((acc, name) => {
		return acc.then(() => {
			return asyncTests[name]()
		}).catch((reason) => {
			if (reason && reason.name === 'AssertionError') {
				reason.message = `${name} failed: ${reason.message}`
			}
			return Promise.reject(reason)
		})
	}, Promise.resolve())
}
