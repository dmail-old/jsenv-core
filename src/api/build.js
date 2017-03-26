/*

- mieux gérer @env (voir suggestion ou autre)
-> ajouter un custom plugin qui supporte les variables dans le from de l'import

*/

var Builder = require('systemjs-builder');

var createTranspiler = require('./util/transpiler.js');
// var mapAsync = require('./util/map-async.js');
// var resolveIfNotPlain = require('./util/resolve-if-not-plain.js');
// function resolve(importee, importer) {
//     var location;
//     var resolved = resolveIfNotPlain(importee, importer);
//     if (resolved === undefined) {
//         location = rootHref + '/' + importee;
//     } else {
//         location = resolved;
//     }
//     return location;
// }

var root = require('path').resolve(process.cwd(), '../../').replace(/\\/g, '/');
var rootHref = 'file:///' + root;
// ptet qu'on écrire ça dans un fichier et qu'on
// modifiera ce qui est écris dans le fichier par un code éxécute en amont de l'envoi du fichier
// on pourrait écrire le fichier comme suit:
/*
export platform = meta`(() => {
    // do stuff to return the platform we are in
})()`
export mode = meta`(() => {
    return 'production';
})()`
*/
var variables = {
    platform: 'node',
    __esModule: true
};

function getProfile() {
    return {
        'string/prototype/at': {test: 'passed'}
    };
}
function isImportUseless(loader, profile, importee, importer) {
    var resolveSync = (loader.resolveSync || loader.normalizeSync).bind(loader);

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
function variablesToConditions(variables) {
    var conditions = {};
    Object.keys(variables).forEach(function(name) {
        conditions['@env|' + name] = variables[name];
    });
    return conditions;
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
function setupLoader(loader) {
    loader.config({
        baseURL: rootHref,
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

    if (loader.registry) {
        loader.registry.set('@env', loader.newModule(variables));
    } else {
        loader.set('@env', loader.newModule(variables));
    }

    // var resolveSymbol = loader.constructor.resolve;
    // var resolve = loader[resolveSymbol];
    // loader[resolveSymbol] = createConsistentResolver(resolve, loader);
    // loader.trace = true;
}
function build(entry, agent) {
    return Promise.resolve(getProfile(agent)).then(function(profile) {
        var builder = new Builder();
        var loader = builder.loader;
        setupLoader(loader);
        var transpiler = getTranspiler();
        var importRemovalPlugin = createTranspiler.removeImport(function(importee, importer) {
            return isImportUseless(loader, profile, importee, importer);
        });
        var replaceImport = createTranspiler.replaceImport();
        transpiler.options.plugins.unshift(replaceImport);
        transpiler.options.plugins.unshift(importRemovalPlugin);
        loader.config({
            meta: {
                '*': {
                    format: 'register'
                }
            }
        });
        loader.translate = function(load) {
            var filename = load.path;
            var transpilationResult = transpiler.transpile(load.source, {
                filename: filename,
                moduleId: load.name
            });
            return transpilationResult.code;
        };
        return builder.trace(entry, {
            conditions: variablesToConditions(variables)
        }).then(function(tree) {
            console.log('the tree', tree);
            // return transpile(tree, transpiler).then(function() {
            //     var hash = loader.configHash;

            //     tree['@env'] = {
            //         name: '@env',
            //         path: null,
            //         metadata: {
            //             format: 'json'
            //         },
            //         deps: [],
            //         depMap: {},
            //         source: JSON.stringify(variables),
            //         fresh: true,
            //         timestamp: null,
            //         configHash: hash
            //     };
            //     // console.log('final tree', Object.keys(tree));

            //     var buildOutputPath = root + '/build/' + hash + '/build.js';
            //     return builder.bundle(tree, buildOutputPath, {
            //         sourceMaps: true
            //     }).then(function() {
            //         return buildOutputPath;
            //     });
            // });
        });
    });
}
build('examples/entry.js').then(function(path) {
    console.log('build path', path);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

function createSystem() {
    var SystemJS = require('systemjs');
    var System = new SystemJS.constructor();
    setupLoader(System);
    System.config({
        transpiler: undefined
    });
    return System;
}
function consumeBuild() {
    var System = createSystem();

    var buildPath = root + '/build/63c9ddd5b47ce990f3be45ffed733252/build.js';
    var code = require('fs').readFileSync(buildPath).toString();
    var vm = require('vm');
    vm.runInThisContext(code, {filename: buildPath});

    return System.import('examples/entry.js');
}
// consumeBuild('examples/entry.js').then(function(exports) {
//     console.log('export', exports);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

function getNodeFilename(filename) {
    filename = String(filename);

    var nodeFilename;
    if (filename.indexOf('file:///') === 0) {
        nodeFilename = filename.slice('file:///'.length);
    } else {
        nodeFilename = filename;
    }
    return nodeFilename;
}
function consume(entry, agent) {
    var System = createSystem();

    var instantiate = System[instantiateMethod];
    var instantiateMethod = System.constructor.instantiate;
    var transpiler = getTranspiler();
    System[instantiateMethod] = function(key, processAnonRegister) {
        if (key.indexOf('@node/') === 0) {
            return instantiate.apply(this, arguments);
        }

        return Promise.resolve(getProfile(agent)).then(function(profile) {
            var importRemovalPlugin = createTranspiler.removeImport(function(importee, importer) {
                return isImportUseless(System, profile, importee, importer);
            });

            transpiler.options.plugins.unshift(importRemovalPlugin);
            var filename = getNodeFilename(key);
            return transpiler.transpileFile(filename).then(function(result) {
                global.System = System;
                var vm = require('vm');
                vm.runInThisContext(result.code, {filename: filename});
                delete global.System;
                processAnonRegister();
            });
        });
    };

    return System.import(entry);
}
// consume('examples/entry.js').then(function(exports) {
//     console.log('export', exports);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

build.consumeBuild = consumeBuild;
build.consume = consume;
module.exports = build;
