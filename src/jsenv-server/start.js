/* eslint-disable no-path-concat */

/*

- renvoyer au client le fichier qu'il doit fetch pour features.js, polyfill.js et features.fixed.js
au lieu de renvoyer le contenu du fichier (permettra de cache pour browser)

- continuer sur l'import de server.js

// pour voir comment le cache http fonctionne (pas utile pour le moment)
https://fetch.spec.whatwg.org/#requests

- externaliser sourcemap au lie de inline base64, enfin faire une option
cela signifie que pour que le cache soit valide il faudra aussi check l'existance de son fichier sourcemap
ou alors toruver une autre soluce

- yield, async, generator, prévoir les features/plugins/polyfill correspondant

-  chaque progresscallback devrait pouvoir dire attend que je te le dise pour faire
le suite, voir même laisse tomber (aucun interêt mais bon) genre event.waitUntil
de sorte qu'on pourrais avoir une interface qui dit
"Nous avons besoin de scanner votre environnement"
[Allez-y]
"Nous avons besoin d'appliquer des correctifs"
[Alley-y]

- race condition writefile ?
si oui faudrais une queue de write pour s'assurer que la dernière version est bien celle
qui est finalement écrit

- more : npm install dynamique

https://github.com/rpominov/fun-task/blob/master/docs/exceptions.md#trycatch
il faut complete/fail/crash et idéalement crash on va juste pas fournir de callback
ce qui par défaut signife throw

*/

require('../jsenv.js');
var featureAPI = require('../features/api.js');
var jsenv = global.jsenv;
var userAgent = jsenv.userAgent;

jsenv.implementation.adapt({
    input: {
        agent: userAgent,
        features: ['const']
    },
    getDistantInstruction: function(instruction, complete) {
        featureAPI.getNextInstruction(instruction, complete);
    }
}).run({
    complete: function(completeEvent) {
        /*
        à specifier, que peut valoir completeEvent d'intéréssant ?
        le temps que ça a pris, est ce que ça venait du cache etc...
        */

        console.log('implementation completed', completeEvent);
    },
    fail: function(failEvent) {
        /*
        là on a l'example ou ça fail pour des raisons maitriser
        ça peut aussi fail à cause du réseau
        ou d'une erreur interne
        */

        console.log('implementation failed', failEvent.reason, failEvent.detail);
    },
    progress: function(progressEvent) {
        /*
        à spécifier
        quelles valeurs peut prendre l'event progress
        surement pas grand chose, à voir
        */

        if (progressEvent.step === 'scan-progress') {
            // var event = progressEvent.event;
            // console.log('scanned', event.target.name, event.target.status, event.loaded, '/', event.total);
        } else if (progressEvent.step === 'fixed-scan-progress') {
            // var fevent = progressEvent.event;
            // console.log('scanned', fevent.target.name, fevent.target.status, fevent.loaded, '/', fevent.total);
        } else {
            // console.log('implementation progress'); // progressEvent);
        }
    }
});
