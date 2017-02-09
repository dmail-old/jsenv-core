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

- changer memoize.file pour une écriture comme suit:
memoize.file(fn, path, {
    sources: [
        {path: , strategy: 'mtime'},
        {path: , strategy: 'eTag'},
    ],
    mode: 'default'
    // pour voir comment le cache http fonctionne (pas utile pour le moment)
    https://fetch.spec.whatwg.org/#requests
    // default : peut écrire et lire depuis le cache (cas par défaut)
    // read-only : peut lire depuis le cache, n'écrira pas dedans (pour travis)
    // write-only : ne peut pas lire depuis le cache, écrira dedans (inutile)
    // only-if-cached: peut lire et throw si le cache est invalide au lieu d'apeller la fonction (inutile mais pourra le devenir un jour)
})

- externaliser sourcemap au lie de inline base64, enfin faire une option
cela signifie que pour que le cache soit valide il faudra aussi check l'existance de son fichier sourcemap
ou alors toruver une autre soluce

- yield, async, generator, prévoir les features/plugins/polyfill correspondant

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

FIX+SCAN et FIX+COMPLETE serais plus propre si on avait un moyen
de récupérer une liste d'instruction et pas une seule
*/

function ensureImplementation(completeCallback, failCallback/* , progressCallback */) {
    var handlers = {
        'SCAN'(instruction, resolve) {
            eval(instruction.detail.code); // eslint-disable-line no-eval
            jsenv.implementation.scan(function(report) {
                resolve({
                    report: report
                });
            });
        },
        'FIX'(instruction, resolve) {
            eval(instruction.detail.code); // eslint-disable-line no-eval
            resolve();
        },
        'CHECK'(instruction, resolve) {
            eval(instruction.detail.code); // eslint-disable-line no-eval
            jsenv.implementation.scan(function(report) {
                resolve({
                    report: report
                });
            });
        },
        'COMPLETE'(instruction, resolve) {
            resolve({
                status: 'COMPLETED',
                reason: instruction.reason,
                detail: instruction.detail
            });
        },
        'FAIL'(instruction, resolve) {
            resolve({
                status: 'FAILED',
                reason: instruction.reason,
                detail: instruction.detail
            });
        }
    };
    function handleInstruction(instruction, state) {
        // si l'instruction est une instruction composée
        // il faut la décomposer et faire instruction par instruction (en série)
        // avant de renvoyer un state composée pour chaque résultat d'instruction
        // complete et fail sont ignoré
        // le serveur stockera l'info sur l'instruction fix pour savoir comment elle se déroule
        // même si 99% du temps il ne devrait pas y avoir de souci
        // si jamais eval des polyfill génère une erreur il ne sers à rien de continuer
        // et le serveur doit posséder cette information
        // ceci est vrai à chaque étape qui peut fail et le serveur en serait alors informé
        // sauf pour des erreurs connue genre réseau etc qui sont pas critique
        // toutes les erreurs non prévue sont considérées comme fatales
        // et font échouer l'ensemble du processus
        // je ne sais pas encore comment je vais gérer ça mais je suppose
        // scan seras stocké dans before-fix (bah oui avec report.json)
        // mais en fait on va appeler ça scan-result.json
        // fix-result.json sera stocké dans after-fix
        // rescan-result.json sera stocké aussi dans after-fix
        // on pourrait aussi avoir 3 folder genre scan/fix/check
        // le truc c'est que fix et rescan utilise le même cache
        // quoique fix n'a besoin que des problematicfeatures de type polyfill
        // alors que rescan de toutes les problematicFeatures
        // n'économisons pas les ressources pour de la perf, soyons clair

        state.step = instruction.code;

        var method = handlers[instruction.code];
        var args = [instruction, function(data) {
            jsenv.assign(state, data || {});
            handleState(state);
        }];

        try {
            method.apply(handlers, args);
        } catch (e) {
            state.status = 'FAILED';
            state.statusReason = 'throw';
            state.statusDetail = e;
            handleState(state);
        }
    }
    function handleState(state) {
        if (state.status === 'FAILED') {
            failCallback();
        } else if (state.status === 'COMPLETED') {
            completeCallback();
        } else {
            getInstruction(
                state,
                function(instruction) {
                    handleInstruction(instruction, state);
                }
            );
        }
    }
    function getInstruction(state, resolve) {
        // la version browser enverras une requête pour savoir
        // cette version va juste appeler une méthode faite exprès pour sur ensureImplementation
        ensure.getInstruction(state, resolve);
    }
    var state = {
        step: 'INITIAL',
        status: 'PENDING',
        userAgent: userAgent
    };
    handleState(state);
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
        failEvent = {
            type: 'fail',
            detail: {
                problems: [
                     {
                        type: 'feature-has-no-solution',
                        meta: {
                            feature: {
                                name: 'feature-name'
                            }
                        }
                    },
                    {
                        type: 'feature-solution-is-invalid',
                        meta: {
                            feature: {
                                name: 'other-feature-name
                            }
                        }
                    }
                ]
            }
        };
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
