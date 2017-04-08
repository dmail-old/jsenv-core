module.exports = (parse, assert) => {
	const dir = "fixtures/consume-two"

	return parse(`./${dir}/main.js`).then((trace) => {
		const root = trace.root
		assert.equal(root.id, `${dir}/main.js`)
	})
}
