import jsenv from 'jsenv';

import assert from '@node/assert';

// transpilation
jsenv.generate({logLevel: 'info'}).then(function(env) {
    var source = 'export default true';
    var sourceAddress = 'anonymous';

    return env.evalMain(source, sourceAddress).then(function() {
        let mainFileSource = env.FileSource.create(env.locate(sourceAddress));

        return mainFileSource.getOriginalSource().then(function(originalSource) {
            assert.equal(originalSource, source);
            console.log('test passed');
        });
    });
});

// transpilation + instrumentation
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
        // assert(sourceAddress in myEnv.coverage.value);

        var mainFileSource = env.FileSource.create(env.locate(sourceAddress) + '!instrumented');

        return mainFileSource.getOriginalSource().then(function(originalSource) {
            assert.equal(originalSource, source);
            console.log('test passed');
        });
    });
});
