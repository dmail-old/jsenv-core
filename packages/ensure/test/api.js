/*
- tester le rapport de résultat (il doit bien contenir le report de tous les tests)
vérifier que les assertions sont run en parallèle
-> comment fait-on si une assertion A throw et B était run en parallèle MAIS B avait set un timeout
ou un truc du genre ? il faudrait que B puisse unset son timeout ou quoi sinon
le script ne rend pas la main
*/

module.exports = (test, assert) => {
	assert.equal(typeof test, 'function')
	assert.throws(() => test(), (e) => e.message === 'test first arg must be a string')
	assert.throws(() => test(true), (e) => e.message === 'test first arg must be a string')
	assert.throws(() => test(''), (e) => e.message === 'test second arg must be a function')
	assert.throws(() => test('', true), (e) => e.message === 'test second arg must be a function')
	assert.equal(typeof test('', () => 1), 'function')

	const asyncTests = {
		'producer called with initialValue'() {
			let producerArgs
			const initialValue = {}
			return test(
				'name',
				(...args) => {
					producerArgs = args
				}
			)(initialValue).then(() => {
				assert.equal(producerArgs[0], initialValue)
			})
		},
		'assertion called with producer return value'() {
			let assertionArgs
			const producerValue = 10
			return test(
				'name',
				() => producerValue,
				(...args) => {
					assertionArgs = args
				}
			)().then(() => {
				assert.equal(assertionArgs[0], producerValue)
			})
		},
		'assertion returning false means failed'() {
			return test(
				'name',
				() => 10,
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
