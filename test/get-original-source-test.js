import jsenv from 'jsenv';

import assert from '@node/assert';

var env = Object.getPrototypeOf(jsenv);

env.generate({logLevel: 'info'}).then(function(myEnv) {
    var source = 'export default true';
    var sourceAddress = 'anonymous';

    return myEnv.evalMain(source, sourceAddress).then(function() {
        let mainFileSource = myEnv.FileSource.create(myEnv.locate(sourceAddress));

        return mainFileSource.getOriginalSource().then(function(originalSource) {
            assert.equal(originalSource, source);
            console.log('test passed');
        });
    });
});
