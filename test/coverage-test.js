import jsenv from 'jsenv';

import assert from '@node/assert';

var env = Object.getPrototypeOf(jsenv);

env.generate({logLevel: 'info'}).then(function(myEnv) {
    var source = 'export default true';
    var sourceAddress = 'anonymous';

    myEnv.config(function() {
        return myEnv.import('jsenv/module-coverage').then(function(exports) {
            var coverage = exports.default.create({
                urlIsPartOfCoverage(url) {
                    return url.includes('anonymous');
                }
            });

            myEnv.coverage = coverage;

            return coverage.install(myEnv);
        });
    });

    return myEnv.evalMain(source, sourceAddress).then(function() {
        // assert(sourceAddress in myEnv.coverage.value);

        var mainFileSource = myEnv.FileSource.create(myEnv.locate(sourceAddress) + '!instrumented');

        // faut s'assurer que j'arrive bien à choper l'original source, ce qui actuellement n'est pas vrai puisque le sourcemap est tout pété
        // ok il semblerai que le fix dans module-coverage règle ce problème, on peut donc ensuite vérifier que j'arrive bien à choper l'originalSource

        return mainFileSource.getOriginalSource().then(function(originalSource) {
            console.log('original', originalSource);
        });
    });
});
