/* eslint-disable no-path-concat */

/*

- continuer sur l'import de server.js

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

// require('../jsenv.js');
// var featureAPI = require('../features/api.js');
// var jsenv = global.jsenv;
// var userAgent = String(jsenv.agent);

// jsenv.adaptImplementation({
//     options: {
//         agent: String(jsenv.agent),
//         features: [
//             'const/scoped'
//         ]
//     },
//     getDistantInstruction: function(instruction, complete, fail) {
//         featureAPI.getDistantInstruction(instruction, complete, fail);
//     }
// }).run({
//     complete: function(completeEvent) {
//         /*
//         à specifier, que peut valoir completeEvent d'intéréssant ?
//         le temps que ça a pris, est ce que ça venait du cache etc...
//         */

//         console.log('implementation completed', completeEvent.reason);
//     },
//     fail: function(failEvent) {
//         /*
//         là on a l'example ou ça fail pour des raisons maitriser
//         ça peut aussi fail à cause du réseau
//         ou d'une erreur interne
//         */

//         console.log('implementation failed', failEvent);
//     },
//     crash: function(crashEvent) {
//         console.log('implementation crashed', crashEvent);
//         setTimeout(function() {
//             throw crashEvent.detail;
//         });
//     },
//     progress: function(progressEvent) {
//         /*
//         à spécifier
//         quelles valeurs peut prendre l'event progress
//         surement pas grand chose, à voir
//         */

//         console.log('implementation progress', progressEvent);
//     }
// });
