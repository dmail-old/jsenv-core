const expect = require('../../../../util/expect.js')

/*
autre manière de l'écrire mais méga power user
en gros all permet d'enchainer une suite de fonctions d'une manière bien spéciale
forward permet de modifier la valeur courante avec laquelle on travaille
called() retourne une fonction qui vaudra true si la valeur courante est un spy called
et forward sur firstCall

module.exports = all({
	'parse': () => parse(`./main.js`, __dirname),
	'transform': (tree) => transform(tree, {exclude: expect.spy()}),
	'exclude': all({
		'read': forward((tree) => tree.options.exlude),
		'called': called(),
		'called with': calledWith('file.js', 'main.js')
	},
	'ressource is excluded': all({
		'read': forward((tree) => tree.root.ressources[0].excluded),
		'equal': equals(true)
	})
})
*/

module.exports = (parse, transform) => {
	return parse(`./main.js`, __dirname).then((tree) => {
		const exclude = expect.spy(() => true)
		return transform(tree, {
			exclude,
		}).then((tree) => {
			expect.calledWith(exclude, 'file.js', 'main.js')
			expect.equal(tree.root.ressources[0].excluded, true)
		})
	})
}
