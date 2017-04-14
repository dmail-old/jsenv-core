/*
*/

module.exports = {
	'test is a function'({test}, assert) {
		assert.equal(typeof test, 'function')
	},
	'last arg must not be a string'({test}, assert) {
		assert.throws(() => test(''), (e) => e.message === 'last arg must not be a string')
	},
	'a string must be followed by a function'({test}, assert) {
		assert.throws(() => test('', true), (e) => e.message === 'a string must be followed by a function')
	},
	'test returns a function'({test}, assert) {
		assert.equal(typeof test(() => {}), 'function')
	},
	'can pass a first argument using test({value})'({test}, assert) {
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
	// 'can timeout test after a given duration'({test}, assert) {
	// 	return test(
	// 		() => new Promise(() => {})
	// 	)({timeout: 50}).then(
	// 		(report) => {
	// 			const {state, detail} = report
	// 			assert.equal(state, 'failed')
	// 			assert.equal(detail.code, 'TEST_TIMEOUT')
	// 		}
	// 	)
	// },
	// 'test timeout is correctly cleared when an other related test fails'
}
