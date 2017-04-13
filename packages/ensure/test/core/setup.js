/*

*/

const {createPromiseResolvedIn} = require('../helpers.js')

module.exports = {
	'setup must be the first assertion'(test, assert) {
		assert.throws(
			() => {
				test(
					() => {},
					test.setup(() => {})
				)
			},
			(error) => error.message === 'setup must be the first assertion'
		)
	},
	'assertion must await setup'(test, assert) {
		let callOrder = []
		return test(
			test.setup(() => createPromiseResolvedIn(50).then(() => {
				callOrder.push('setup')
			})),
			() => {
				callOrder.push('assertion')
			}
		)().then(
			() => assert.equal(callOrder.join(), 'setup,assertion')
		)
	},
	'teardown must be called after assertion'(test, assert) {
		let teardownCalled = false
		return test(
			test.setup(() => {
				return () => {
					teardownCalled = true
				}
			}),
			() => {}
		)().then(
			() => assert(teardownCalled)
		)
	},
	'teardown must be called even if assertion failed'(test, assert) {
		let teardownCalled = false
		return test(
			test.setup(() => {
				return () => {
					teardownCalled = true
				}
			}),
			() => false
		)().then(
			() => assert(teardownCalled)
		)
	},
	'teardown must be called even with unexpected assertion exception'(test, assert) {
		let teardownCalled = false
		return test(
			test.setup(() => {
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
	'teardown must be called if parallel assertion fail'(test, assert) {
		// here we test that even if an assertion coming after is failing
		// while the first is still pending, the teardown is still called
		let teardownCalled = false
		return test(
			() => test(
				test.setup(() => {
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
