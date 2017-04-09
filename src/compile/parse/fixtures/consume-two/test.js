module.exports = (parse, assert) => {
	return parse(`./main.js`, __dirname).then((trace) => {
		const root = trace.root
		assert.equal(root.id, `${__dirname}/main.js`)
	})
}
