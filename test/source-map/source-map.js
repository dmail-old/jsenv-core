import jsenv from 'jsenv';

var env = Object.getPrototypeOf(jsenv);

env.generate({logLevel: 'info'}).then(function(envA) {
    // ce qu'on veut vérifier c'est qu'on récup bien la sourcemap, dabord en base64
    // ensuite tester que si on est pas en base64 mais avec un lien, ça marche aussi
    // tester une nested sourcemap en minifiant l'output de system.translate juste pour tester le comportement
    // faudra aussi tester le coverage en combinaison avec sourcemap, nottameent remap istanbul

    envA.importMain('./module.js').then(function(exports) {
        console.log(exports.default);
    });
});
