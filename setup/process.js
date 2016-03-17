/* global */

import platform from 'platform';

platform.setVersion(require('os').release());
platform.engine.setName(parseInt(process.version.match(/^v(\d+)\./)[1]) >= 1 ? 'iojs' : 'node');
platform.engine.setVersion(process.version.slice(1));
platform.language.set(process.env.lang);

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
    platform.registerCoreModule('node/' + name, require(name));
});
