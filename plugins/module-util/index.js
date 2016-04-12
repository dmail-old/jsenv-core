import engine from 'engine';

[
    'dependency-graph',
    'iterable',
    'options',
    'proto',
    'thenable',
    'timeout'
].forEach(function(moduleName) {
    System.paths[moduleName] = engine.dirname + '/lib/util/' + moduleName + '/index.js';
});

// System.paths.proto = engine.dirname + '/node_modules/@dmail/proto/index.js';
