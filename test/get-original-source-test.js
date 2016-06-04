import jsenv from 'jsenv';
import env from 'env';

import assert from '@node/assert';

var source = 'export default true';
var sourceAddress = 'anonymous';
var sourceURL = env.locate(sourceAddress);

Promise.resolve().then(function() {
    // transpilation
    return jsenv.generate({logLevel: 'info'}).then(function(env) {
        return env.evalMain(source, sourceAddress);
    }).then(function() {
        return env.FileSource.create(sourceURL);
    }).then(function(mainFileSource) {
        return mainFileSource.prepare().then(function() {
            return mainFileSource;
        });
    }).then(function(mainFileSource) {
        assert.equal(mainFileSource.getOriginalSource(), source);
        console.log('getOriginalSource() ok with transpiled anonymous modules');
    });
}).then(function() {
    // transpilation + instrumentation
    return jsenv.generate({logLevel: 'info'}).then(function(env) {
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

        return env.evalMain(source, sourceAddress);
    }).then(function() {
        // assert(sourceAddress in myEnv.coverage.value);
        return env.FileSource.create(sourceURL);
    }).then(function(mainFileSource) {
        return mainFileSource.prepare().then(function() {
            return mainFileSource;
        });
    }).then(function(mainFileSource) {
        assert.equal(mainFileSource.getOriginalSource(), source);
        console.log('getOriginalSource() ok with transpiled & instrumented anonymous module');
    });
});
