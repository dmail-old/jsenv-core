const {createPromiseResolvedIn} = require('../helpers.js')

module.exports = {
	'assertion cannot return test'({test}, assert) {
		// we don't want to allow assertion to return a test
		// because test structure would become unpredictable :
		// !!you would have to call assertion to know it returns a test!!
		// for that reason assertion returning a test is not supported
		// we could just ignore this but there is like 99% chance the one
		// who wrote an assertion returning a test is not aware of the implications
		// and just wanted to add a subtest

		// we may be even more strict by not allowing to call test()
		// inside an assertion but that may be a pain (impossible?) to detect

		return test(
			() => test()
		)().catch(
			(reason) => {
				assert.equal(reason.code, 'CANNOT_RETURN_TEST_IN_ASSERTION')
				assert.equal(reason.message, 'malformed test: assertion cannot return test')
			}
		)
	},
	'assertion throwing is unexpected'({test}, assert) {
		const value = {}
		return test(
			() => {
				throw value
			}
		)().then(
			() => assert.fail('resolved', 'rejected', 'test must be rejected'),
			(reason) => assert.equal(reason, value)
		)
	},
	'assertion rejection is unexpected'({test}, assert) {
		const value = {}
		return test(
			() => Promise.reject(value)
		)().then(
			() => assert.fail('resolved', 'rejected', 'test must be rejected'),
			(reason) => assert.equal(reason, value)
		)
	},
	'assertion can throw assertion error'({test}) {
		return test(
			() => {
				throw test.fail({code: 'MY_CODE', message: 'my failed assertion message'})
			}
		)
	},
	'assertion can return false to fail'({test}, assert) {
		return test(
			() => false
		)().then(
			(report) => assert.equal(report.state, 'failed')
		)
	},
	'assertion are runned in parallel'({test}, assert) {
		let callOrder = []
		return test(
			() => {
				callOrder.push('first')
				return Promise.resolve().then(() => {
					callOrder.push('first-resolved')
				})
			},
			() => {
				callOrder.push('second')
			}
		)().then(
			() => assert.equal(callOrder.join(), 'first,second,first-resolved')
		)
	},
	// canceller: to be tested
	'assertion canceller called when self fail'({test}, assert) {
		let called = false
		return test(
			(value, context) => {
				context.cancel = () => {
					called = true
				}
				return false
			}
		)().then(
			() => assert(called === true)
		)
	},
	'assertion canceller called when self reject'({test}, assert) {
		let called = false
		return test(
			(value, context) => {
				context.cancel = () => {
					called = true
				}
				throw new Error('here')
			}
		)().then(
			() => assert.fail('resolved', 'rejected'),
			() => assert(called === true)
		)
	},
	'assertion canceller called when pending & something else fails'({test}, assert) {
		let called = false
		return test(
			(value, context) => {
				context.cancel = () => {
					called = true
				}
				return createPromiseResolvedIn(10)
			},
			() => false
		)().then(
			() => assert(called === true)
		)
	},
	'assertion canceller not called when not pending & something else fails'({test}, assert) {
		let called = false
		return test(
			(value, context) => {
				context.cancel = () => {
					called = true
				}
			},
			() => false
		)().then(
			() => assert(called === false)
		)
	},
	'assertion canceller is called when pending & something else reject'({test}, assert) {
		let called = false
		return test(
			(value, context) => {
				context.cancel = () => {
					called = true
				}
				return createPromiseResolvedIn(10)
			},
			() => Promise.reject('yo')
		)().then(
			() => assert.fail('resolved', 'rejected'),
			() => assert(called === true)
		)
	},
	'assertion canceller not called when not pending & something else rejects'({test}, assert) {
		let called = false
		return test(
			(value, context) => {
				context.cancel = () => {
					called = true
				}
			},
			() => Promise.reject('yo')
		)().then(
			() => assert.fail('resolved', 'rejected'),
			() => assert(called === false)
		)
	}
}
