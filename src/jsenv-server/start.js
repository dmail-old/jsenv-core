/* eslint-disable no-path-concat */

/*
- continuer sur l'import de server.js

- faire en sorte que même avant de démarrer le serveur on est du code qui se comporte comme son propre client
vis-a-vis du comportement qu'aura le client plus tard
1 : lorsqu'on le requête, si le client qui le demande est inconnu au bataillon
alors il lui dit hey client veut tu bien lancer ces tests pour que je sache si on est compatible ?
ensuite le client lui donne le résultats des tests
le serveur répond alors avec un polyfill.js que le client doit éxécuter
le client doit aussi rerun les tests pour vérifier que polyfill.js fonctionne bien
    si tout se passe bien alors le client envoit une requête au serveur
    pour lui dire hey mec nickel chrome merci
    là le serveur stocke cette info pour savoir que pour ce type de client tout va bien

    si ça ne se passe pas bien le client affiche une erreur et envoie au serveur
    mec ça marche ton truc
    le serveur stocke cette info pour savoir que pour ce type de client y'a un souci

- quand et comment le client lance-t-il une première requête de compatibilité avec les features requises ?
-> au chargement de la page, avant toute chose et à chaque fois on demande au serveur si on est compatiblez
- sous quel format dit-on au client: voici les tests que tu dois lancer ?
-> 200 + une sorte de json contenant tous les tests serais top, le prob étant que ce n'est pas leur forme actuelle
autre souci du JSON: les fonctions devraient être eval, un peu relou
le plus simple serait donc de renvoyer un js
- sous quel format dit-on au client: c'est mort tu n'est pas polyfillable ?
-> on lui renvoit un code d'erreur genre pas 200 avec un message associé
- sous quel format dit-on au client: voici le polyfill que tu dois éxécuter, pas besoin de test ?
-> 200 + le pollyfill en tant que fichier js qu'on éxécute sans se poser de question

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

*/

require('../jsenv.js');
var ensure = require('../features/ensure.js');
var jsenv = global.jsenv;
var userAgent = jsenv.userAgent;

/*
1 - bonjour, je suis {userAgent}, que dois-je faire ?
    -> évalue ces tests
    ok je fais ça, bye
2 - (re) bonjour, je suis {userAgent}, voici les résultats de tests
    -> éxécute ces correctifs puis évalue ces tests v2
    ok je fais ça bye
3 - (re,re) bonjour, je suis {userAgent}, voici les résultats de tests v2
    -> merci, je vais juste stocker l'info

quand je lis ça j'ai l'impression que le client ne fais quasi rien
par contre il est possible qu'à tout moment les appels distants
permettent de skip une/plusieur étapes pour aller directement à la fin

donc il faut comencer par faire un truc qui dit ok je suis {userAgent} que dois-je faire ?
*/

function ensureImplementation(completeCallback, failCallback, progressCallback) {
    var handlers = {
        'SCAN'(instruction, complete) {
            eval(instruction.value.code); // eslint-disable-line no-eval

            jsenv.implementation.scan(
                function(report) {
                    complete(report);
                },
                function(event) {
                    progressCallback({
                        step: 'scan-progress',
                        event: event
                    });
                }
            );
        },
        'FIX'(instruction, complete) {
            eval(instruction.value.fix); // eslint-disable-line no-eval

            if ('features' in instruction.value) {
                eval(instruction.value.features); // eslint-disable-line no-eval
                jsenv.implementation.scan(
                    function(report) {
                        complete(report);
                    },
                    function(event) {
                        progressCallback({
                            step: 'fixed-scan-progress',
                            event: event
                        });
                    }
                );
            } else {
                complete();
            }
        }
    };
    function handleInstruction(instruction) {
        var result = instruction.result;

        function complete(data) {
            result.status = 'completed';
            result.value = data || {};
            getNextInstruction(instruction);
        }
        function fail(data) {
            result.status = 'failed';
            result.value = data || {};
            getNextInstruction(instruction);
        }

        if (result.status === 'pending') {
            var method = handlers[instruction.name];
            var args = [instruction, complete, fail];

            try {
                method.apply(handlers, args);
            } catch (e) {
                fail(e);
            }
        } else {
            getNextInstruction(instruction);
        }
    }
    function getNextInstruction(instruction) {
        // la version browser enverras une requête pour savoir
        // cette version va juste appeler une méthode faite exprès pour sur ensureImplementation
        ensure.getNextInstruction(
            instruction,
            function(nextInstruction) {
                nextInstruction.meta = instruction.meta;
                progressCallback({
                    step: 'after-' + nextInstruction.name
                });
                if (nextInstruction.name === 'COMPLETE') {
                    completeCallback();
                } else if (nextInstruction.name === 'FAIL') {
                    failCallback();
                } else {
                    progressCallback({
                        step: 'before-' + nextInstruction.name
                    });
                    handleInstruction(nextInstruction);
                }
            }
        );
    }
    var instruction = {
        name: 'START',
        meta: {
            userAgent: userAgent
        },
        result: {
            status: 'completed'
        }
    };
    getNextInstruction(instruction);
}

ensureImplementation(
    function(completeEvent) {
        /*
        à specifier, que peut valoir completeEvent d'intéréssant ?
        le temps que ça a pris, est ce que ça venait du cache etc...
        */

        console.log('implementation completed', completeEvent);
    },
    function(failEvent) {
        /*
        là on a l'example ou ça fail pour des raisons maitriser
        ça peut aussi fail à cause du réseau
        ou d'une erreur interne
        */

        console.log('implementation failed', failEvent);
    },
    function(progressEvent) {
        /*
        à spécifier
        quelles valeurs peut prendre l'event progress
        surement pas grand chose, à voir
        */

        console.log('implementation progress', progressEvent);
    }
);

/*
function start() {
    System.trace = true;
    System.meta['*.json'] = {format: 'json'};
    System.config({
        map: {
            '@jsenv/compose': jsenv.dirname + '/node_modules/jsenv-compose'
        },
        packages: {
            '@jsenv/compose': {
                main: 'index.js',
                format: 'es6'
            }
        }
    });

    function createModuleExportingDefault(defaultExportsValue) {
        return this.System.newModule({
            "default": defaultExportsValue // eslint-disable-line quote-props
        });
    }
    function registerCoreModule(moduleName, defaultExport) {
        System.set(moduleName, createModuleExportingDefault(defaultExport));
    }
    function prefixModule(name) {
        var prefix = jsenv.modulePrefix;
        var prefixedName;
        if (prefix) {
            prefixedName = prefix + '/' + name;
        } else {
            prefixedName = name;
        }

        return prefixedName;
    }

    [
        'action',
        'fetch-as-text',
        'iterable',
        'lazy-module',
        'options',
        'thenable',
        'rest',
        'server',
        'timeout',
        'url'
    ].forEach(function(libName) {
        var libPath = jsenv.dirname + '/src/' + libName + '/index.js';
        System.paths[prefixModule(libName)] = libPath;
    }, this);

    var oldImport = System.import;
    System.import = function() {
        return oldImport.apply(this, arguments).catch(function(error) {
            if (error && error instanceof Error) {
                var originalError = error;
                while ('originalErr' in originalError) {
                    originalError = originalError.originalErr;
                }
                return Promise.reject(originalError);
            }
            return error;
        });
    };

    registerCoreModule(prefixModule(jsenv.rootModuleName), jsenv);
    registerCoreModule(prefixModule(jsenv.moduleName), jsenv);
    registerCoreModule('@node/require', require);
    return System.import(jsenv.dirname + '/setup.js').then(function(exports) {
        return exports.default(jsenv);
    }).then(function() {
        return System.import(jsenv.dirname + '/src/jsenv-server/serve.js');
    });
}

start().catch(function(e) {
    if (e) {
        // because unhandled rejection may not be available so error gets ignored
        setTimeout(function() {
            // console.log('the error', e);
            throw e;
        });
    }
});

*/
