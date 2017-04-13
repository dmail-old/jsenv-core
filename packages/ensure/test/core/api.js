/*
- tester le rapport de résultat (il doit bien contenir le report de tous les tests)
vérifier que les assertions sont run en parallèle
-> comment fait-on si une assertion A throw et B était run en parallèle MAIS B avait set un timeout
ou un truc du genre ? il faudrait que B puisse unset son timeout ou quoi sinon
le script ne rend pas la main
*/

module.exports = {
	'test is a function'(test, assert) {
		assert.equal(typeof test, 'function')
	},
	'last arg must not be a string'(test, assert) {
		assert.throws(() => test(''), (e) => e.message === 'last arg must not be a string')
	},
	'a string must be followed by a function'(test, assert) {
		assert.throws(() => test('', true), (e) => e.message === 'a string must be followed by a function')
	},
	'test returns a function'(test, assert) {
		assert.equal(typeof test('', () => 1), 'function')
	},
	'can pass a first argument using test({value})'(test, assert) {
		let assertionArgs
		const value = 10
		return test(
			(...args) => {
				assertionArgs = args
			}
		)({value}).then(() => {
			assert.equal(assertionArgs[0], value)
		})
	},
	'assertion returning false means failed'(test, assert) {
		return test(
			() => false
		)().then((report) => {
			assert.equal(report.state, 'failed')
		})
	}
}
