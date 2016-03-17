/* global engine */

// https://github.com/sindresorhus/os-locale/blob/master/index.js
var nativeModules = [
    'assert',
    'http',
    'https',
    'fs',
    'stream',
    'path',
    'url',
    'querystring',
    'child_process',
    'util',
    'os'
];

nativeModules.forEach(function(name) {
    engine.registerCoreModule('node/' + name, require(name));
});

// https://nodejs.org/api/process.html#process_process_platform
// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
engine.setName(process.platform === 'win32' ? 'windows' : process.platform);
engine.setVersion(process.version.slice(1));
engine.platform.setVersion(require('os').release());
engine.language.set(process.env.lang);
