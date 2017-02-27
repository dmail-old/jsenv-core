/*

*/

var rollup = require('rollup');
var path = require('path');
var cuid = require('cuid');

require('../jsenv.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var uneval = require('../uneval.js');

function normalizePath(path) {
    return path.replace(/\\/g, '/');
}

var rootFolder = normalizePath(path.resolve(__dirname, '../../'));
var cacheFolder = rootFolder + '/cache';
var builderCacheFolder = cacheFolder + '/builder';
var builderCache = store.fileSystemCache(builderCacheFolder);
// var cwd = normalizePath(process.cwd());

function generateSourceImporting(importDescriptions) {
    var i = 0;
    var j = importDescriptions.length;
    var importSources = [];
    var collectorSources = [];

    while (i < j) {
        var importDescription = importDescriptions[i];
        var importInstructions = importDescription.import.split(',').map(function(name) { // eslint-disable-line
            name = name.trim();
            return {
                name: name,
                as: name + '$' + i
            };
        });

        var importSource = '';
        importSource += 'import {';
        importSource += importInstructions.map(function(importInstruction) {
            return importInstruction.name + ' as ' + importInstruction.as;
        }).join(', ');
        importSource += '}';
        importSource += ' from ';
        importSource += "'" + importDescription.from + "'";
        importSource += ';';
        importSources.push(importSource);

        var collectorSource = '';
        collectorSource += 'collect({';
        collectorSource += importInstructions.map(function(importInstruction) {
            return '"' + importInstruction.name + '": ' + importInstruction.as;
        }).join(', ');
        collectorSource += '});';
        collectorSources.push(collectorSource);
        i++;
    }

    return (
        importSources.join('\n') +
        '\n\n' +
        'var collector = [];\n' +
        'function collect(a) {\n' +
        '   collector.push(a);\n' +
        '}' +
        '\n' +
        collectorSources.join('\n') +
        '\n' +
        'export default collector;'
    );
}
function pickImports(importDescriptors, options) {
    options = options || {};
    var root = options.root;
    var transpiler = options.transpiler;
    var mainExportName = options.mainExportName || 'default';

    return builderCache.match({
        imports: importDescriptors,
        root: root
    }).then(function(cacheBranch) {
        var entry = cacheBranch.entry({
            name: 'build.js',
            mode: 'write-only'
        });
        return entry;
    }).then(function(entry) {
        return memoize.async(
            build,
            entry
        )();
    });

    // function getImportDescriptorFor(id) {
    //     return jsenv.Iterable.find(importDescriptors, function(importDescriptor) {
    //         var resolvedPath = path.resolve(rootFolder, importDescriptor.from);
    //         var normalized = normalizePath(resolvedPath);
    //         return normalized === normalizePath(id);
    //     });
    // }

    function build() {
        var moduleSource = generateSourceImporting(importDescriptors, root);
        // console.log('the source', moduleSource);
        var entryId = cuid() + '.js';
        var entryPath = root + '/' + entryId;
        // var temporaryFolderPath = normalizePath(osTmpDir());
        // var temporaryFilePath = temporaryFolderPath + '/' + cuid() + '.js';
        return rollup.rollup({
            entry: entryId,
            onwarn: function(warning) {
                if (
                    warning.code === 'EVAL' &&
                    normalizePath(warning.loc.file) === normalizePath(
                        path.resolve(root, './helper/detect.js')
                    )
                ) {
                    return;
                }
                console.log(warning.loc.file);
                console.warn(warning.message);
            },
            plugins: [
                {
                    name: 'name',
                    load: function(id) {
                        if (normalizePath(id) === entryPath) {
                            return moduleSource;
                        }
                    },
                    resolveId: function(importee, importer) {
                        if (importee.slice(0, 2) === '//') {
                            return path.resolve(root, importee.slice(2));
                        }
                        if (importee[0] === '/') {
                            return path.resolve(root, importee.slice(1));
                        }
                        if (importee.slice(0, 2) === './' || importee.slice(0, 3) === '../') {
                            if (importer) {
                                if (normalizePath(importer) === entryPath) {
                                    return path.resolve(root, importee);
                                }
                                return path.resolve(path.dirname(importer), importee);
                            }
                            return importee;
                        }
                        return path.resolve(root, importee);
                    },
                    transform: function(code, id) {
                        var normalizedPath = normalizePath(id);
                        if (transpiler && normalizedPath !== entryPath) {
                            var result = transpiler.transpile(code, {
                                filename: normalizedPath,
                                sourceRoot: root
                            });
                            return {
                                code: result
                                // we should return ast & sourcemap
                                // of the transpiler
                            };
                        }
                    }
                }
            ]
        }).then(function(bundle) {
            var result = bundle.generate({
                format: 'iife',
                // because we can't be sure people will use 'use strict' so consider the worts scenario
                // the one where they don't have use strict
                useStrict: false,
                moduleName: '__exports__',
                indent: true,
                exports: 'named',
                banner: 'var __exports__ = {};',
                intro: '"intro";',
                outro: (
                    '__exports__[' + uneval(mainExportName) + '] = collector;\n' +
                    '__exports__.meta = ' + uneval(options.meta || {}) + ';'
                ),
                footer: '__exports__;'
            });
            return result.code;
        });
    }
}

module.exports = pickImports;

// build({
//     features: [
//         'promise',
//         'promise/unhandled-rejection'
//     ]
// }).then(eval).then(function(exports) {
//     console.log(exports);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
