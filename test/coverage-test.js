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
        return env.coverage.remap(env.coverage.value);
    }).then(function(coverage) {
        console.log('coverage', coverage);
    });
});
