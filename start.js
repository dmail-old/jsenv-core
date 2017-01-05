/*

https://github.com/zloirock/core-js#custom-build-from-external-scripts

-

*/

require('./index.js');

global.jsenv.generate().then(function(env) {
    var mainModuleURL = env.locate('./server.js');
    return env.importMain(mainModuleURL);
});
