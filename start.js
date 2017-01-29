/* eslint-disable no-path-concat */

/*

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

- où stocker l'info pour dire ce type de client a pu être polyfillé correctement ou non ?

- quand et comment le client lance-t-il une première requête de compatibilité avec les features requises ?
-> au chargement de la page, avant toute chose et à chaque fois on demande au serveur si on est compatiblez
- sous quel format dit-on au client: voici les tests que tu dois lancer ?
-> 200 + une sorte de json contenant tous les tests serais top, le prob étant que ce n'est pas leur forme actuelle
autre souci du JSON: les fonctions devraient être eval, un peu relou
le plus simple serait donc de renvoyer un js
peut être que les tests resteront dans index.js mais que on les lance pas si pas besoin
de sorte qu'on garde la possibilité de les lancer si on le souhaite pour whatever raison
- sous quel format dit-on au client: c'est mort tu n'est pas polyfillable ?
-> on lui renvoit un code d'erreur genre pas 200 avec un message associé
- sous quel format dit-on au client: voici le polyfill que tu dois éxécuter, pas besoin de test ?
-> 200 + le pollyfill en tant que fichier js qu'on éxécute sans se poser de question

- continuer sur l'import de server.js

- une fois que le serveur peut être lancé celui-ci va être capable de plusieurs chose

- externaliser sourcemap au lie de inline base64, enfin faire une option
cela signifie que pour que le cache soit valide il faudra aussi check l'existance de son fichier sourcemap
ou alors toruver une autre soluce

- yield, async, generator, prévoir les features/plugins/polyfill correspondant

- race condition writefile ?
si oui faudrais une queue de write pour s'assurer que la dernière version est bien celle
qui est finalement écrit

- more : npm install dynamique

*/

require('./src/jsenv-server/start.js');
