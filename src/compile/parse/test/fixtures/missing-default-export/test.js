const ensureRejected = require('../../../../util/ensure-rejected.js')
const assert = require('assert')

module.exports = (parse) => {
	return ensureRejected(
		parse('./main.js', __dirname)
	).then((e) => {
		assert.equal(e.message, 'default is not exported by ./file.js')
		assert.equal(e.code, 'MISSING_EXPORT')
		assert.equal(e.loc.line, 1)
		assert.equal(e.loc.column, 7)
	})
}
