module.exports = {
	'fail returns an assertionError'(test, assert) {
		const error = test.fail()
		assert.equal(error.name, 'AssertionError')
	},
	'fail accept a code param'(test, assert) {
		const error = test.fail({code: 'ERROR_CODE'})
		assert.equal(error.code, 'ERROR_CODE')
	}
}
