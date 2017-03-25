var store = require('./store.js');
var memoize = require('./memoize.js');
var fsAsync = require('./fs-async.js');
var locateSourceMap = require('./source-map-locate.js');

var path = require('path');
var rootFolder = path.resolve(__dirname, '../../../').replace(/\\/g, '/');
var ancestorFolder = path.resolve(rootFolder, '../').replace(/\\/g, '/');
var cacheFolder = rootFolder + '/cache';
var transpilerCacheFolder = cacheFolder + '/transpiler';

function assign(destination, source) {
    for (var key in source) { // eslint-disable-line guard-for-in
        if (key === 'sourceURL' && destination[key] === false) {
            continue;
        }
        destination[key] = source[key];
    }
    return destination;
}
function normalizePlugins(pluginsOption) {
    var normalizedPluginsOption = pluginsOption.map(function(pluginOption) {
        var plugin;
        if (typeof pluginOption === 'string' || typeof pluginOption === 'function') {
            plugin = [pluginOption, {}];
        } else {
            plugin = pluginOption;
        }
        var pluginFunction = plugin[0];
        var pluginOptions = plugin[1] || {};
        if (typeof pluginFunction === 'string') {
            return [pluginFunction, pluginOptions];
        }
        if (typeof pluginFunction === 'function') {
            return [pluginFunction.name, pluginOptions];
        }
        return [pluginFunction, pluginOptions];
    });
    // console.log('normalize', pluginsOption, '->', normalizedPluginsOption);
    return normalizedPluginsOption;
}
function getSourcemapBasename(filename) {
    var sourceMapBasename = path.basename(filename) + '.map';
    return sourceMapBasename;
}
function getSourceMapFilename(filename) {
    var sourceMapBasename = getSourcemapBasename(filename);
    var sourceMapUrl = path.dirname(filename) + '/' + sourceMapBasename;
    return sourceMapUrl.replace(/\\/g, '/');
}

function createTranspiler(transpilerOptions) {
    transpilerOptions = transpilerOptions || {plugins: []};

    function getOptions(transpilationOptions) {
        transpilationOptions = transpilationOptions || {};
        var options = {};
        assign(options, transpilerOptions);
        assign(options, transpilationOptions);

        var plugins;
        // transpilationOptions.plugins override transpilerOptions.plugins
        if (transpilationOptions.plugins) {
            plugins = transpilationOptions.plugins;
        } else {
            plugins = options.plugins ? options.plugins.slice() : [];
            if (options.as === 'module') {
                plugins.unshift('transform-es2015-modules-systemjs');
            }
        }
        options.plugins = plugins;
        return options;
    }
    function getNodeFilePath(path) {
        var nodeFilePath;
        if (path.indexOf('file:///') === 0) {
            nodeFilePath = path.slice('file:///'.length);
        } else {
            nodeFilePath = path;
        }
        return nodeFilePath;
    }
    function getFileEntry(options) {
        if (options.cache === false) {
            return null;
        }

        var filename = options.filename;
        if (filename) {
            var nodeFilePath = getNodeFilePath(filename);
            if (nodeFilePath.indexOf(ancestorFolder) !== 0) {
                // console.log('node file path', nodeFilePath);
                throw new Error('cannot transpile file not inside ' + ancestorFolder);
            }

            var relativeFilePath = nodeFilePath.slice(ancestorFolder.length);
            if (relativeFilePath[0] === '/') {
                relativeFilePath = relativeFilePath.slice(1);
            }
            var entryName = relativeFilePath;
            var sources;
            if (options.sources) {
                sources = options.sources.slice();
            } else {
                sources = [];
            }
            sources.push({
                path: nodeFilePath,
                strategy: 'mtime'
            });

            var properties = {
                path: transpilerCacheFolder,
                name: entryName,
                behaviour: 'branch',
                normalize: function(options) {
                    return {
                        plugins: normalizePlugins(options.plugins)
                    };
                },
                sources: sources,
                mode: options.cacheMode || 'default',
                save: function(filename, result, options) {
                    if (result.code) {
                        // var sourceURL = path.relative(ancestorFolder, filename).replace(/\\/g, '/');
                        var sourceURL = '';
                        sourceURL += 'file:///';
                        sourceURL += filename;
                        result.code += '\n//# sourceURL=' + sourceURL;
                    }

                    if (options.sourceMaps) {
                        var sourceMapBasename = getSourcemapBasename(filename);
                        var sourceMapFilename = getSourceMapFilename(filename);
                        // encoreURIComponent sur sourceMapBasename ?
                        result.code += '\n//# sourceMappingURL=' + sourceMapBasename;
                        locateSourceMap(result.map, filename);
                        return Promise.all([
                            fsAsync.setFileContent(filename, result.code),
                            fsAsync.setFileContent(sourceMapFilename, JSON.stringify(result.map))
                        ]);
                    }
                    return fsAsync.setFileContent(filename, result.code);
                },
                retrieve: function(filename, options) {
                    if (options.sourceMaps) {
                        return Promise.all([
                            fsAsync.getFileContent(filename),
                            fsAsync.getFileContent(getSourceMapFilename(filename))
                        ]).then(function(values) {
                            return {
                                code: values[0],
                                map: values[1] ? JSON.parse(values[1]) : {} // if the file is empty
                            };
                        });
                    }
                    return fsAsync.getFileContent(filename).then(function(code) {
                        return {
                            code: code
                        };
                    });
                }
            };
            var entry = store.fileSystemEntry(properties);
            return entry;
        }
        return null;
    }
    function transpile(code, transpileCodeOptions) {
        var options = getOptions(transpileCodeOptions);

        function transpileSource(options) {
            // https://babeljs.io/docs/core-packages/#options
            // inputSourceMap: null,
            // minified: false

            // console.log('transpiling', code, 'for', sourceURL);
            var filename = options.filename;
            var babelOptions = {};
            babelOptions.filename = options.filename;
            babelOptions.plugins = options.plugins;
            babelOptions.ast = true;
            babelOptions.sourceMaps = true;
            if (options.compact) {
                babelOptions.compact = options.compact;
            }
            if (options.comments) {
                babelOptions.comments = options.comments;
            }
            if (options.minified) {
                babelOptions.minified = options.minified;
            }
            // babelOptions.sourceType = 'module';
            if (options.sourceRoot) {
                babelOptions.sourceRoot = options.sourceRoot;
            }

            var babel = require('babel-core');
            var result;
            try {
                result = babel.transform(code, babelOptions);
            } catch (e) {
                if (e.name === 'SyntaxError' && options.ignoreSyntaxError !== true) {
                    console.log('the options', options);
                    console.error(e.message, 'in', filename, 'at\n');
                    console.error(e.codeFrame);
                }
                throw e;
            }
            var transpiledCode = result.code;
            // if (filename && options.as !== 'code' && options.sourceURL !== false) {
            //     var sourceURL;
            //     if (options.sourceURL) {
            //         sourceURL = options.sourceURL;
            //     } else {
            //         sourceURL = filename + '!transpiled';
            //     }
            //     transpiledCode += '\n//# sourceURL=' + sourceURL;
            // }
            // if (options.transform) {
            //     transpiledCode = options.transform(transpiledCode);
            // }
            result.code = transpiledCode;
            return result;
        }

        var entry = getFileEntry(options);
        if (entry) {
            // options.filename = entry.path;
            return memoize.async(
                transpileSource,
                entry
            )(options);
        }
        return transpileSource(options);
    }
    function transpileFileSource(filename, options) {
        return fsAsync.getFileContent(filename).then(function(code) {
            return transpile(code, options);
        });
    }
    function transpileFile(filename, transpileFileOptions) {
        var options = getOptions(transpileFileOptions);
        filename = path.resolve(process.cwd(), filename).replace(/\\/g, '/');
        options.filename = filename;

        var entry = getFileEntry(options);
        if (entry) {
            options.cache = false; // désactive le cache puisque y'a déjà celui-la
            return entry.get(options).then(function(data) {
                if (data.valid) {
                    return data;
                }
                return transpileFileSource(filename, options).then(function(value) {
                    return entry.set(value, options);
                });
            }).then(function(data) {
                if (options.onlyPath) {
                    return data.path;
                }
                return data.value;
            });
        }
        return transpileFileSource(filename, options);
    }

    var transpiler = {
        options: transpilerOptions,
        transpile: transpile,
        transpileFile: transpileFile,
        clone: function() {
            return createTranspiler(transpilerOptions);
        },
        getNormalizedPlugins: function() {
            return normalizePlugins(transpilerOptions.plugins);
        },
        minify: function() {
            var minifiedTranspiler = createTranspiler(transpilerOptions);
            var minifiedOptions = minifiedTranspiler.options;
            var minifiedPlugins = minifiedOptions.plugins.slice();
            minifiedOptions.plugins = minifiedPlugins;

            minifiedOptions.compact = true;
            minifiedOptions.comments = false;
            minifiedOptions.minified = true;
            minifiedPlugins.push(
                ['minify-constant-folding']
            );
            minifiedPlugins.push(
                [
                    'minify-dead-code-elimination',
                    {
                        "keepFnName": true,
                        "keepFnArgs": true,
                        "keepClassName": true
                    }
                ]
            );
            minifiedPlugins.push(
                ['minify-guarded-expressions']
            );
            minifiedPlugins.push(
                [
                    'minify-mangle-names',
                    {
                        keepFnName: true,
                        keepClassName: true
                    }
                ]
            );
            minifiedPlugins.push(
                ['minify-simplify']
            );
            minifiedPlugins.push(
                ['minify-type-constructors']
            );
            minifiedPlugins.push(
                ['transform-merge-sibling-variables']
            );
            minifiedPlugins.push(
                ['transform-minify-booleans']
            );
            minifiedPlugins.push(
                ['transform-simplify-comparison-operators']
            );
            minifiedPlugins.push(
                'transform-undefined-to-void'
            );

            return minifiedTranspiler;
        }
    };

    return transpiler;
}

function transpileTemplateTaggedWith(transpile, TAG_NAME) {
    TAG_NAME = TAG_NAME || 'transpile';

    function transformTemplateLiteralsTaggedWithPlugin(babel) {
        // inspired from babel-transform-template-literals
        // https://github.com/babel/babel/blob/master/packages/babel-plugin-transform-es2015-template-literals/src/index.js#L36
        var t = babel.types;

        function transpileTemplate(strings) {
            var result;
            // var raw = strings.raw;
            var i = 0;
            var j = strings.length;
            result = strings[i];
            i++;
            while (i < j) {
                result += arguments[i];
                result += strings[i];
                i++;
            }
            try {
                return transpile(result).code;
            } catch (e) {
                // if there is an error
                // let test a chance to eval untranspiled string
                // and catch error it may be a test which is trying
                // to ensure compilation error (syntax error for example)
                return result;
            }
        }

        function visitTaggedTemplateExpression(path, state) {
            var node = path.node;
            if (!t.isIdentifier(node.tag, {name: TAG_NAME})) {
                return;
            }
            var quasi = node.quasi;
            var quasis = quasi.quasis;
            var expressions = quasi.expressions;

            var values = expressions.map(function(expression) {
                return expression.evaluate().value;
            });
            var strings = quasis.map(function(quasi) {
                return quasi.value.cooked;
            });
            var raw = quasis.map(function(quasi) {
                return quasi.value.raw;
            });
            strings.raw = raw;

            var tanspileArgs = [];
            tanspileArgs.push(strings);
            tanspileArgs.push.apply(tanspileArgs, values);
            var transpiled = transpileTemplate.apply(null, tanspileArgs);

            var args = [];
            var templateObject = state.file.addTemplateObject(
                'taggedTemplateLiteralLoose',
                t.arrayExpression([
                    t.stringLiteral(transpiled)
                ]),
                t.arrayExpression([
                    t.stringLiteral(transpiled)
                ])
            );
            args.push(templateObject);
            path.replaceWith(t.callExpression(node.tag, args));
        }

        return {
            name: 'transform-template-literals-tagged-with',
            visitor: {
                TaggedTemplateExpression: visitTaggedTemplateExpression
            }
        };
    }

    return transformTemplateLiteralsTaggedWithPlugin;
}
createTranspiler.transpileTemplateTaggedWith = transpileTemplateTaggedWith;

function generateExport() {
    // https://github.com/babel/babel/blob/master/packages/babel-plugin-transform-es2015-modules-systemjs/src/index.js
    function generateExportPlugin(babel) {
        // console.log('babel', Object.keys(babel));
        // var types = babel.types;

        function visitProgram(path, state) {
            var file = state.file;
            var fileOptions = file.opts;
            // var parserOptions = file.parserOpts;
            // var node = path.node;
            // console.log('visiting file', parserOptions);
            // console.log('opts', fileOptions);

            var filename = fileOptions.filename;
            var sourceRoot = fileOptions.sourceRoot;
            var shortFileName;

            if (sourceRoot) {
                shortFileName = require('path').relative(sourceRoot, filename).replace(/\\/g, '/');
            } else {
                shortFileName = filename;
            }

            var result = babel.transform(
                'var filename = "' + shortFileName + '";\nexport {filename};\n\n',
                {
                    code: false,
                    sourceMaps: false,
                    sourceType: 'module',
                    babelrc: false,
                    ast: true,
                    plugins: []
                }
            );
            var ast = result.ast;
            var body = ast.program.body;
            path.unshiftContainer('body', body);
        }

        return {
            visitor: {
                Program: visitProgram
            }
        };
    }

    return generateExportPlugin;
}
createTranspiler.generateExport = generateExport;

function removeImport(fn) {
    function removeImportPlugin() {
        function visitImportDeclaration(path, state) {
            if (fn(path.node.source.value, state.file.opts.filename)) {
                var prev;//  = path.getSibling(path.key -1);
                var next;//  = path.getSibling(path.key + 1);

                var from = path.node.source.value;
                var commentString = ' import \'' + from + '\'';
                path.remove();
                // add a comment here to show that there was an import here
                // that was auto removed because not required
                prev = path.getSibling(path.key - 1);
                next = path.getSibling(path.key + 1);
                if (prev && prev.node) {
                    prev.addComment('trailing', commentString, true);
                } else if (next && next.node) {
                    next.addComment('leading', commentString, true);
                }
            }
        }

        return {
            visitor: {
                ImportDeclaration: visitImportDeclaration
            }
        };
    }

    return removeImportPlugin;
}
createTranspiler.removeImport = removeImport;

module.exports = createTranspiler;
