import jsenv from 'jsenv';
import env from 'env';

import assert from '@node/assert';

var selfUrl = env.mainAction.module.href;
var selfRedirectedURL = env.FileSource.redirect(selfUrl);

Promise.resolve().then(function() {
    // self source
    assert(selfRedirectedURL in env.FileSource.cache);
    console.log('self source is correctly cached');

    // console.log(selfUrl, selfRedirectedURL);
    // console.log(env.FileSource.redirections);
    // console.log(Object.keys(env.FileSource.cache));
}).then(function() {
    return jsenv.generate({logLevel: 'info'}).then(function(env) {

    });
});
