/*

// pour voir comment le cache http fonctionne (pas utile pour le moment)
https://fetch.spec.whatwg.org/#requests

-  chaque progresscallback devrait pouvoir dire attend que je te le dise pour faire
le suite, voir même laisse tomber (aucun interêt mais bon) genre event.waitUntil
de sorte qu'on pourrais avoir une interface qui dit
"Nous avons besoin de scanner votre environnement"
[Allez-y]
"Nous avons besoin d'appliquer des correctifs"
[Alley-y]

- more : npm install dynamique

https://github.com/rpominov/fun-task/blob/master/docs/exceptions.md#trycatch
il faut complete/fail/crash et idéalement crash on va juste pas fournir de callback
ce qui par défaut signife throw

*/
