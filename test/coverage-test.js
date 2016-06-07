import jsenv from 'jsenv';

// import assert from '@node/assert';

jsenv.generate({logLevel: 'info'}).then(function(env) {
    var source = `
    export default function() {
        return true;
    }
    `;
    var sourceAddress = 'anonymous';

    return env.importDefault('env/module-coverage').then(function(Coverage) {
        var coverage = Coverage.create({
            urlIsPartOfCoverage(url) {
                return url.includes(sourceAddress);
            }
        });

        env.coverage = coverage;

        return coverage.install(env);
    }).then(function() {
        return env.evalMain(source, sourceAddress);
    }).then(function(exports) {
        return exports.default();
    }).then(function() {
        return env.coverage.collect();
    }).then(function(coverage) {
        console.log('coverage', coverage);
    });
});
