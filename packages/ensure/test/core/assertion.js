module.exports = {
	'assertion throwing is unexpected'(test, assert) {
		const value = {}
		return test(
			() => {
				throw value
			}
		).then(
			() => assert.fail('resolved', 'rejected', 'test must be rejected'),
			(reason) => assert.equal(reason, value)
		)
	},
	'assertion rejection is unexpected'(test, assert) {
		const value = {}
		return test(
			() => Promise.reject(value)
		).then(
			() => assert.fail('resolved', 'rejected', 'test must be rejected'),
			(reason) => assert.equal(reason, value)
		)
	},
	'assertion can throw assertion error'(test) {
		return test(
			() => {
				throw test.fail({code: 'MY_CODE', message: 'my failed assertion message'})
			}
		)
	},
	'assertion can return false to fail'(test, assert) {
		let called = false
		return test(
			() => false,
			() => {
				called = true
			}
		).then(
			() => assert(called === false)
		)
	},
	'assertion are runned in parallel'(test, assert) {
		let callOrder = []
		return test(
			() => new Promise((resolve) => {
				setTimeout(resolve, 10)
			}).then(() => {
				callOrder.push('first-resolved')
			}),
			() => {
				callOrder.push('second')
			}
		).then(
			() => assert.equal(callOrder.join(), 'first-resolved,second')
		)
	}
}
