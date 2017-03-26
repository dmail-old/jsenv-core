/*

*/

var createTranspiler = require('./util/transpiler.js');

var root = require('path').resolve(process.cwd(), '../../').replace(/\\/g, '/');
var rootHref = 'file:///' + root;
var variables = {
    platform: 'node'
};

function getProfile() {
    return {
        'string/prototype/at': {test: 'passed'}
    };
}
function isImportUseless(loader, profile, importee, importer) {
    var resolveSync = loader.resolveSync.bind(loader);

    var location = resolveSync(importee, importer);
    var featureFolderLocation = resolveSync('src/features');
    if (location.indexOf(featureFolderLocation) === 0) {
        var ressource = location.slice(featureFolderLocation.length + 1);
        var featureName = ressource.split('/').slice(0, -1).join('/');
        if (featureName && featureName in profile) {
            var featureInfo = profile[featureName];
            return featureInfo.test === 'passed';
        }
        return false;
    }
    return false;
}
function getTranspiler() {
    var transpiler = createTranspiler({
        cache: false,
        sourceMaps: true,
        plugins: [
            'babel-plugin-transform-es2015-modules-systemjs'
        ]
    });
    return transpiler;
}
function createLoader() {
    var SystemJS = require('systemjs');
    var System = new SystemJS.constructor();
    System.config({
        transpiler: undefined,
        baseURL: rootHref,
        meta: {
            '*': {
                format: 'register'
            }
        },
        map: {
            'core-js': 'node_modules/core-js'
        },
        packages: {
            'core-js': {
                main: 'index.js',
                format: 'cjs',
                defaultExtension: 'js'
            }
        }
    });
    // if (loader.registry) {
    //     loader.registry.set('@env', loader.newModule(variables));
    // } else {
    //     loader.set('@env', loader.newModule(variables));
    // }
    // var resolveSymbol = loader.constructor.resolve;
    // var resolve = loader[resolveSymbol];
    // loader[resolveSymbol] = createConsistentResolver(resolve, loader);
    // loader.trace = true;
    return System;
}
function build(entry, agent) {
    return Promise.resolve(getProfile(agent)).then(function(profile) {
        var loader = createLoader();

        var importRemovalPlugin = createTranspiler.removeImport(function(importee, importer) {
            return isImportUseless(loader, profile, importee, importer);
        });
        var replaceImportPlugin = createTranspiler.replaceImport(variables);
        var transpiler = getTranspiler();

        transpiler.options.plugins.unshift(importRemovalPlugin);
        transpiler.options.plugins.unshift(replaceImportPlugin);

        loader.resolveSync(entry);
    });
}
build('examples/entry.js').then(function(path) {
    console.log('build path', path);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

// function consumeBuild() {
//     var System = createSystem();

//     var buildPath = root + '/build/63c9ddd5b47ce990f3be45ffed733252/build.js';
//     var code = require('fs').readFileSync(buildPath).toString();
//     var vm = require('vm');
//     vm.runInThisContext(code, {filename: buildPath});

//     return System.import('examples/entry.js');
// }
// consumeBuild('examples/entry.js').then(function(exports) {
//     console.log('export', exports);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

// function getNodeFilename(filename) {
//     filename = String(filename);

//     var nodeFilename;
//     if (filename.indexOf('file:///') === 0) {
//         nodeFilename = filename.slice('file:///'.length);
//     } else {
//         nodeFilename = filename;
//     }
//     return nodeFilename;
// }
// function consume(entry, agent) {
//     var System = createSystem();

//     var instantiate = System[instantiateMethod];
//     var instantiateMethod = System.constructor.instantiate;
//     var transpiler = getTranspiler();
//     System[instantiateMethod] = function(key, processAnonRegister) {
//         if (key.indexOf('@node/') === 0) {
//             return instantiate.apply(this, arguments);
//         }

//         return Promise.resolve(getProfile(agent)).then(function(profile) {
//             var importRemovalPlugin = createTranspiler.removeImport(function(importee, importer) {
//                 return isImportUseless(System, profile, importee, importer);
//             });

//             transpiler.options.plugins.unshift(importRemovalPlugin);
//             var filename = getNodeFilename(key);
//             return transpiler.transpileFile(filename).then(function(result) {
//                 global.System = System;
//                 var vm = require('vm');
//                 vm.runInThisContext(result.code, {filename: filename});
//                 delete global.System;
//                 processAnonRegister();
//             });
//         });
//     };

//     return System.import(entry);
// }
// consume('examples/entry.js').then(function(exports) {
//     console.log('export', exports);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

// build.consumeBuild = consumeBuild;
// build.consume = consume;
module.exports = build;
