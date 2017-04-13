/*
- test.setup
pouvoir setup un test, par ex
test(
	setup(() => {
		const server = http.createServer()
		return server.open().then(() => {
			return () => server.close()
		})
	}),
	...assertions
)
cela signifique démarre un serveur pendent ce test et arrête le à la fin

plusieurs choses : en cas d'erreur il faut appeler le teardown
à la fin des tests il faut aussi appeler le teardown
vu qu'on utilise Promise.all() pour run les assertions
il faut que si une assertion throw et que d'autre assertions sont encore en cours
de réalisation on apelle aussi le teardown

on va en permier écrire les tests puis faire l'implémentation

- setup doit se trouver en tout premier (interdit de mettre ot chose qu'une string avant)
- setup retourne une fonction un peu spéciale que le test runner reconnaitra et considèrera
comme une fonction a éxécuter en amont et dont le retour doit être éxécute en aval

*/
