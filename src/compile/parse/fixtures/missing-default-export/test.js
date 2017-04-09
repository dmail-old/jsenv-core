const ensureRejectedWith = require('../../../util/ensure-rejected-with.js')

module.exports = (parse) => {
	const dir = `${__dirname}/missing-default-export`

	return ensureRejectedWith(parse(`${dir}/main.js`), (e) => {
		console.log(e)
		return e.code === "MISSING_EXPORT"
	})
}
