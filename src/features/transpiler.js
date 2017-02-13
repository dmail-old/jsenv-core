var store = require('../store.js');
var memoize = require('../memoize.js');
var fsAsync = require('../fs-async.js');

var rootFolder = require('path').resolve(__dirname, '../..').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var transpileFolder = cacheFolder + '/transpile';
var transpileCache = store.fileSystemCache(transpileFolder);

function createTranspiler(options) {
    // console.log('required babel plugins', pluginsAsOptions.map(function(plugin) {
    //     return plugin[0];
    // }));

    function getNodeFilePath(path) {
        var nodeFilePath;
        if (path.indexOf('file:///') === 0) {
            nodeFilePath = path.slice('file:///'.length);
        } else {
            nodeFilePath = path;
        }
        return nodeFilePath;
    }
    function getFileEntry(transpilationOptions) {
        var path = transpilationOptions.filename;
        var nodeFilePath = getNodeFilePath(path);

        if (nodeFilePath.indexOf(rootFolder) === 0) {
            var relativeFilePath = nodeFilePath.slice(rootFolder.length);
            if (relativeFilePath[0] === '/') {
                relativeFilePath = relativeFilePath.slice(1);
            }

            return transpileCache.match({
                plugins: options.plugins
            }).then(function(cacheBranch) {
                var entryName;
                if (transpilationOptions.as === 'module') {
                    entryName = 'modules/' + relativeFilePath;
                } else {
                    entryName = relativeFilePath;
                }

                var entrySources;
                if (transpilationOptions.sources) {
                    entrySources = transpilationOptions.sources.slice();
                } else {
                    entrySources = [];
                }
                entrySources.push({path: nodeFilePath, strategy: 'mtime'});

                var entry = cacheBranch.entry({
                    name: entryName,
                    sources: entrySources
                });
                return entry;
            });
        }
        return Promise.resolve(null);
    }

    var transpile = function(code, transpilationOptions) {
        transpilationOptions = transpilationOptions || {};

        var transpileCode = function(sourceURL) {
            var plugins;
            if (transpilationOptions.plugins) {
                plugins = transpilationOptions.plugins;
            } else if (transpilationOptions.as === 'module') {
                plugins = options.plugins.slice();
                plugins.unshift('transform-es2015-modules-systemjs');
            } else {
                plugins = options.plugins;
            }

            // https://babeljs.io/docs/core-packages/#options
            // inputSourceMap: null,
            // minified: false

            var babelOptions = {};
            babelOptions.plugins = plugins;
            babelOptions.ast = false;
            if ('sourceMaps' in transpilationOptions) {
                babelOptions.sourceMaps = transpilationOptions.sourceMaps;
            } else {
                babelOptions.sourceMaps = 'inline';
            }

            var babel = require('babel-core');
            var result = babel.transform(code, babelOptions);
            var transpiledCode = result.code;

            if (sourceURL) {
                transpiledCode += '\n//# sourceURL=' + sourceURL;
            }
            if (transpilationOptions.transform) {
                transpiledCode = transpilationOptions.transform(transpiledCode);
            }
            return transpiledCode;
        };

        var sourceURL;
        if ('filename' in transpilationOptions) {
            var filename = transpilationOptions.filename;
            if (filename !== false) {
                sourceURL = filename;
            }
        } else {
            sourceURL = 'anonymous';
        }

        if (
            options.cache &&
            transpilationOptions.cache !== false &&
            sourceURL !== 'anonymous' &&
            sourceURL
        ) {
            return getFileEntry(transpilationOptions).then(function(entry) {
                if (entry) {
                    sourceURL = entry.path;
                    return memoize.async(
                        transpileCode,
                        entry
                    )(sourceURL);
                }
                if (sourceURL) {
                    sourceURL += '!transpiled';
                }
                return transpileCode(sourceURL);
            });
        }

        if ('sourceURL' in transpilationOptions) {
            sourceURL = transpilationOptions.sourceURL;
        } else if (sourceURL) {
            sourceURL += '!transpiled';
        }
        return transpileCode(sourceURL);
    };

    var transpiler = {
        // plugins: pluginsAsOptions,
        transpile: transpile,
        transpileFile: function(filePath, transpileFileOptions) {
            function createTranspiledCode(transpileCodeOptions) {
                return fsAsync.getFileContent(transpileCodeOptions.filename).then(function(code) {
                    return transpiler.transpile(code, transpileCodeOptions);
                });
            }

            // désactive le cache lorsque entry ne matche pas
            // puisqu'on a déjà tester s'il existait un cache valide
            var transpileCodeOptions = {};
            jsenv.assign(transpileCodeOptions, transpileFileOptions);
            transpileCodeOptions.filename = filePath;

            return getFileEntry(transpileCodeOptions).then(function(entry) {
                if (entry) {
                    transpileCodeOptions.cache = false;
                    transpileCodeOptions.sourceURL = entry.path;

                    return memoize.async(
                        createTranspiledCode,
                        entry
                    )(transpileCodeOptions);
                }
                return createTranspiledCode(transpileCodeOptions);
            });
        }
    };

    return transpiler;
}

module.exports = createTranspiler;
