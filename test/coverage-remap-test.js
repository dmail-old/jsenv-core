import jsenv from 'jsenv';

// import require from '@node/require';
// import assert from '@node/assert';

Promise.resolve().then(function() {
    // remap
    return jsenv.generate({logLevel: 'info'}).then(function(env) {
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
            return env.coverage.remap(coverage);
        }).then(function(remappedCoverage) {
            return env.coverage.upload(remappedCoverage, 'f695edf1-d0f4-4799-bb08-46955137f0c3');
            /*
            console.log('remapped', data.coverage);

            var istanbul = require('istanbul');
            var reporter = new istanbul.Reporter(null, './coverage-report/');

            reporter.add('html');

            return new Promise(function(resolve) {
                reporter.write(data.collector, false, resolve);
            }).then(function() {
                console.log('html report generated');
            });
            */
        });
    });
});
