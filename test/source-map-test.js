import jsenv from 'jsenv';

// let System = jsenv.System;

var env = Object.getPrototypeOf(jsenv);

env.generate({logLevel: 'info'}).then(function(myEnv) {
    // myEnv.config(function() {
    //     return myEnv.import('jsenv/module-coverage').then(function(exports) {
    //         var coverage = exports.default.create({
    //             urlIsPartOfCoverage(url) {
    //                 return url.includes('anonymous');
    //             }
    //         });

    //         return coverage.install(myEnv);
    //     });
    // });

    return myEnv.evalMain('export default true', 'anonymous').then(function() {
        let source = myEnv.FileSource.create(myEnv.locate('anonymous'));

        return source.import().then(function() {
            return source;
        });
    });
});

/*
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
