const expect = require('../../../../util/expect.js')

/*
cons test = expect(
	call(parse, () => ['./main.js', __dirname]),
	call(transform, (tree) => [tree, {exclude: spy()}]),
	previousCall(
		at('args', '1', 'exclude'),
		called(),
		calledWith('file.js', 'main.js')
	),
	previousCall(
		at('returnValue'),
		equals(true)
	)
)
module.exports = test

les principaux problème ac cette approche c'est qu'on pars du principe
que les tests doivent être run en série (pas tant un souci que ça)
mais surtout quon se fait chier à tout nommer
de plus là on peut voir que la branch first ressource is excluded doit attendre
la fin de "exclude is called", je dis pourquoi pas MAIS la branche "exclude is called"
ne dois pas modifier la valeur courant sur laquelle on travaille
je dis pourquoi pas en fait c pas dégeu

par défaut un test aurait X ms pour se résoudre
on peut override ça en passant à expect un second arg
et si on souhaite modifier le timeout individuel de chaque sous composant
de expect alors là je sais pas trop
si le timeout < globaltimeout il suffirais de wrap la fonction que l'on souhaite
avec un truc genre

// retourne fail si fn ne se résoud pas dans le temps imparti
// par défaut les tests peuvent prendre le temps qu'ils veulent mais doivent
// tout de même se résoudre au final dans le temps imparti globalement (mettons 2min)
// si un test doit fail dans un temps inférieur à ce temps global
// alors il faudra appeler timeout dessus

const timeout = (fn, ms) => {
	// pass si fn resolve/reject avant ms
	// fail sinon
}

const reject = (fn) => {
	// pass avec rejection value
	// fail avec resolution value
}

const test = expect({
	'produce': () => {
		return parse('./main.js', __dirname).then((tree) => {
			return transform(tree, { exclude: spy() })
		})
	},
	'exclude is called': expect({
		'at': at((v) => v.options.exclude),
		'called': called(),
		'calledWith': calledWith('file.js', 'main.js')
	}),
	'first ressource is excluded': expect({
		'at': at((v) => v.root.ressources[0].excluded),
		'excluded': equals(true)
	})
)
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
