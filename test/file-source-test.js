import jsenv from 'jsenv';
import env from 'env';

import assert from '@node/assert';

var selfUrl = env.mainAction.module.href;

Promise.resolve().then(function() {
    // self source
    assert(env.sources.has(selfUrl));
    console.log('self source is correctly cached');

    // console.log(selfUrl, selfRedirectedURL);
    // console.log(env.FileSource.redirections);
    // console.log(Object.keys(env.FileSource.cache));
}).then(function() {
    var source = 'export default true';
    var sourceAddress = 'anonymous';
    var sourceURL = env.locate(sourceAddress);

    return jsenv.generate({logLevel: 'info'}).then(function(env) {
        return env.evalMain(source, sourceAddress);
    }).then(function() {
        assert(env.sources.has(sourceURL));
        console.log('anonymous module source is correctly cached');
    });
});
