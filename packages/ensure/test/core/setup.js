/*

*/

const {createPromiseResolvedIn} = require('../helpers.js')

module.exports = {
	'setup must be the first assertion'({test, setup}, assert) {
		assert.throws(
			() => {
				test(
					() => {},
					setup(() => {})
				)
			},
			(error) => error.message === 'setup must be the first assertion'
		)
	},
	'only one setup assertion allowed per test'({test, setup}, assert) {
		assert.throws(
			() => {
				test(
					setup(() => {}),
					setup(() => {})
				)
			},
			(error) => error.message === 'only one setup assertion allowed per test'
		)
	},
	'assertion must await setup'({test, setup}, assert) {
		let callOrder = []
		return test(
			setup(() => createPromiseResolvedIn(50).then(() => {
				callOrder.push('setup')
			})),
			() => {
				callOrder.push('assertion')
			}
		)().then(
			() => assert.equal(callOrder.join(), 'setup,assertion')
		)
	},
	'teardown must be called after assertion'({test, setup}, assert) {
		let teardownCalled = false
		return test(
			setup(() => {
				return () => {
					teardownCalled = true
				}
			}),
			() => {}
		)().then(
			() => assert(teardownCalled)
		)
	},
	'teardown must be called even if assertion failed'({test, setup}, assert) {
		let teardownCalled = false
		return test(
			setup(() => {
				return () => {
					teardownCalled = true
				}
			}),
			() => false
		)().then(
			() => assert(teardownCalled)
		)
	},
	'teardown must be called even with unexpected assertion exception'({test, setup}, assert) {
		let teardownCalled = false
		return test(
			setup(() => {
				return () => {
					teardownCalled = true
				}
			}),
			() => {
				throw new Error()
			}
		)().then(
			() => assert.fail('resolved', 'rejected', 'expected to reject'),
			() => assert(teardownCalled)
		)
	},
	'teardown must be called if parallel assertion fail'({test, setup}, assert) {
		// here we test that even if an assertion coming after is failing
		// while the first is still pending, the teardown is still called
		let teardownCalled = false
		return test(
			() => test(
				setup(() => {
					return () => {
						teardownCalled = true
					}
				}),
				() => new Promise() // wait forever
			),
			() => false
		).then(
			() => assert(teardownCalled)
		)
	}
}
