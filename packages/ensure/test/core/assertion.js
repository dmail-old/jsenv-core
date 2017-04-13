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
	'assertionError are expected and populate the report'(test, assert) {

	},
	'assertion returning false creates an assertionError'(test, assert) {
		return test(
			'i am false',
			() => false
		).then(
			(report) => {
				assert.equal(report.state, 'failed')
				const assertionReport = report.detail[0]
				assert.equal(assertionReport.state, 'failed')
				const assertionError = assertionReport.detail
				assert.equal(assertionError.name, 'AssertionError')
				assert.equal(assertionError.code, 'RESOLVED_TO_FALSE')
				assert.equal(assertionError.message, 'i am false resolved to false')
			}
		)
	}
}
