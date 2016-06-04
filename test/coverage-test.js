import jsenv from 'jsenv';

// import assert from '@node/assert';

// donc pour coverage il faut voir le coverage object qu'on obtient
// puis vérifier que remap marche bien

jsenv.generate({logLevel: 'info'}).then(function(env) {
    var source = 'export default true';
    var sourceAddress = 'anonymous';

    env.config(function() {
        return env.import('env/module-coverage').then(function(exports) {
            var coverage = exports.default.create({
                urlIsPartOfCoverage(url) {
                    return url.includes('anonymous');
                }
            });

            env.coverage = coverage;

            return coverage.install(env);
        });
    });

    return env.evalMain(source, sourceAddress).then(function() {
        // var remapFile = jsenv.FileSource.create(jsenv.locate('../lib/module-coverage/remap.js'));

        // return remapFile.prepare().then(function() {
        //     console.log(remapFile.sourceMap.consumer.originalPositionFor({
        //         line: 222,
        //         column: 29
        //     }));

        //     console.log(remapFile.getOriginalPosition({
        //         line: 222,
        //         column: 29
        //     }));
        // });

        return env.coverage.remap(env.coverage.value);
    }).then(function(coverage) {
        console.log('coverage', coverage);
    });
});
