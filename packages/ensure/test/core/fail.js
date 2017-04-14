module.exports = {
	'fail returns an assertionError'({fail}, assert) {
		const error = fail()
		assert.equal(error.name, 'AssertionError')
	},
	'fail accept a code param'({fail}, assert) {
		const error = fail({code: 'ERROR_CODE'})
		assert.equal(error.code, 'ERROR_CODE')
	}
}
