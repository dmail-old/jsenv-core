import env from 'env';

function resolve(url, parentURL) {
    let nameURI = env.createURI(url);

    if (nameURI.protocol === 'github') {
        var pathparts = nameURI.pathname.split('/');

        if (pathparts.length === 2 || (pathparts.length === 3 && pathparts[2] === '')) {
            nameURI.pathname += '/index.js';
        }

        if (!nameURI.hash) {
            if (parentURL) {
                var parentURI = env.createURI(parentURL);
                nameURI.hash = parentURI.hash || 'master';
            } else {
                nameURI.hash = 'master';
            }
        }
    }

    return nameURI.href;
}

function assertResolve(url, expected, parentURL) {
    var resolved = resolve(url, parentURL);
    console.log('resolve', resolved, '===', expected, resolved === expected);
}

// you can omit the file & the version
assertResolve('github://dmail/repo', 'github:dmail/repo/index.js#master');
// you can target a file
assertResolve('github:dmail/repo/file.js', 'github:dmail/repo/file.js#master');
// you can target a file & a version
assertResolve('github:dmail/repo/file.js#develop', 'github:dmail/repo/file.js#develop');
// // child will inherit the parent version
assertResolve('github:dmail/repo/file.js', 'github:dmail/repo/file.js#develop', 'github:dmail/repo/index.js#develop');

// System.normalize('./file.js', 'github:dmail/test.js').then(console.log);
// according to the result of the above line, we can just hook after normalization to check if protocol is github
// and react accordingly
var System = env.System;
var normalize = System.normalize;
System.normalize = function(name, parentName, parentAddress) {
    return normalize.apply(this, arguments).then(function(normalizedName) {
        // console.log('before resolve', normalizedName);
        return resolve(normalizedName, parentAddress);
    });
};

function assertNormalize(url, parentURL, expected) {
    System.normalize(url, parentURL, parentURL).then(function(normalizedName) {
        console.log('normalize', normalizedName, '===', expected, normalizedName === expected);
    });
}

assertNormalize('./file.js', 'github:dmail/repo/index.js', 'github:dmail/repo/file.js#master');

// // relative url are not considered, and resolved to their parentName
// assertResolve('./github/repo', 'https://google.fr', 'https://google.fr/github/repo');
// // absolute url are ignored
// assertResolve('https://github.com/repo', 'https://google.fr', 'https://github.com/repo');
// // you can target a version
// assertResolve('github/repo#develop', '', 'github:repo/index.js#develop');
// // you can target a file
// assertResolve('github/repo/file.js', '', 'https://github.com/repo/file.js#master');
// // you can target a file & a version
// assertResolve('github/repo/file.js#develop', '', 'https://github.com/repo/file.js#develop');
// // a file inside a file inside a registry inherit from the registry
// assertResolve('./file.js', 'github/repo', 'https://github.com/repo/file.js#master');
// // you can target a user on the registry
// assertResolve('dmail@github/repo/file.js', '', 'https://dmail@github.com/repo/file.js#master');
