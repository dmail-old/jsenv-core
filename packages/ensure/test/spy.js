module.exports = (test) => {
	const spy = 1
	const calledWith = 1
	const equals = 1
	const pipe = 1

	const suite = test(
		'exclude is called and exclude the corresponding ressource',
		pipe(() => System.import('parse').then((parse) => {
			return Promise.all([
				parse(`./main.js`, __dirname),
				System.import('transform')
			]).then(([
				tree,
				transform
			]) => {
				const exclude = spy(() => true)
				return transform(tree, {exclude}).then(() => ({tree, exclude}))
			})
		})),
		'exclude called with importee/importer',
		({exclude}) => calledWith(exclude, 'file.js', 'main.js'),
		'first ressource is marked as excluded',
		({tree}) => equals(tree.root.ressources[0].excluded, true)
	)
	return suite
}
