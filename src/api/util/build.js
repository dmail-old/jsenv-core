var rollup = require('rollup');
var path = require('path');

var buildAbstractSource = require('./build-abstract-source.js');
var uneval = require('./uneval.js');

function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
function buildSource(abstractObjects, options) {
    options = options || {};

    function build(abstractObjects, options) {
        var root = options.root;
        var transpiler = options.transpiler;
        var mainExportName = options.mainExportName || 'default';
        var exportsName = options.exportsName || '__exports__';
        var minify = options.minify || false;

        var moduleSource = buildAbstractSource(abstractObjects, minify);
        var entryId = 'fake-entry.js';
        var entryPath = root + '/' + entryId;
        return rollup.rollup({
            entry: entryId,
            onwarn: function(warning) {
                if (
                    warning.code === 'EVAL' &&
                    normalizePath(warning.loc.file) === normalizePath(
                        path.resolve(root, './test-helpers.js')
                    )
                ) {
                    return;
                }
                console.warn(warning.message);
            },
            plugins: [
                {
                    name: 'name',
                    load: function(id) {
                        id = normalizePath(id);
                        if (id === entryPath) {
                            return moduleSource;
                        }
                        if (options.load) {
                            return options.load(id);
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
                        if (normalizedPath !== entryPath) {
                            if (transpiler) {
                                return Promise.resolve(
                                    transpiler.transpile(code, {
                                        filename: normalizedPath,
                                        sourceRoot: root
                                    })
                                ).then(function(result) {
                                    return {
                                        code: result.code,
                                        map: result.map
                                        // ast: result.ast.program
                                    };
                                }).catch(function(e) {
                                    console.log('error during transpilation', e.stack);
                                    return Promise.reject(e);
                                });
                            }
                        }
                    }
                }
            ]
        }).then(function(bundle) {
            var footer = exportsName + ';';
            if (options.footer) {
                footer += minify ? '' : '\n';
                footer += options.footer;
            }

            var result = bundle.generate({
                format: 'iife',
                // because we can't be sure people will use 'use strict' so consider the worts scenario
                // the one where they don't have use strict
                useStrict: false,
                moduleName: exportsName,
                sourceMap: true,
                indent: !options.minify,
                exports: 'named',
                banner: 'var ' + exportsName + '= {};',
                // intro: '"intro";',
                outro: (
                    exportsName + '[' + uneval(mainExportName) + '] = collector;' +
                    (minify ? '' : '\n') +
                    exportsName + '.meta = ' + uneval(options.meta || {}) + ';'
                ),
                footer: footer
            });
            return result;
        });
    }

    return build(abstractObjects, options);
    // var rootFolder = normalizePath(path.resolve(__dirname, '../../'));
    // var cacheFolder = rootFolder + '/cache';
    // var builderCacheFolder = cacheFolder + '/builder';
    // var store = require('../store/store.js');
    // var memoize = require('../memoize.js');
    // var properties = {
    //     normalize: function(abstractObjects, options) {
    //         return {
    //             abstracts: abstractObjects,
    //             main: options.mainExportName
    //         };
    //     },
    //     path: builderCacheFolder,
    //     name: 'build.js',
    //     mode: 'write-only'
    // };
    // return memoize.async(
    //     build,
    //     store.fileSystemEntry(properties)
    // )(abstractObjects, options);
}
function build(abstractFeatures, options) {
    return buildSource(abstractFeatures, {
        root: options.root,
        transpiler: options.transpiler,
        meta: options.meta,
        mainExportName: 'features',
        load: options.load,
        footer: options.footer
    }).then(function(result) {
        var code = result.code;
        return {
            code: code,
            map: result.map,
            compile: function() {
                return eval(code);
            }
        };
    });
}

module.exports = build;
