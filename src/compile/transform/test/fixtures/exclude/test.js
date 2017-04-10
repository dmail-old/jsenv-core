const expect = require('../../../../util/expect.js')

module.exports = (parse, transform) => {
	return parse(`./main.js`, __dirname).then((tree) => {
		const exclude = expect.spy(() => true)
		return transform(tree, {
			exclude,
		}).then((tree) => {
			expect.called(exclude)
			expect.calledWith(exclude, 'file.js', 'main.js')
			expect.equal(tree.root.ressources[0].excluded, true)
		})
	})
}
