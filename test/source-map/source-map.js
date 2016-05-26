import jsenv from 'jsenv';

let System = jsenv.System;

System.module('export default true', {address: 'anonymous'}).then(function() {
    let load = System.loads.undefined;
    // expect load.metadata.source.url to be 'anonymous!transpiled'
    // expect load.fetchParent() to return a source named 'anonymous' with data === 'export default true'

    console.log(load.metadata.source.sourceMap);
});

/*
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
*/
