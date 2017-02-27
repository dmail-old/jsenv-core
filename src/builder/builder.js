/*

*/

var rollup = require('rollup');
var path = require('path');
var cuid = require('cuid');

require('../jsenv.js');
var store = require('../store.js');
var memoize = require('../memoize.js');
var uneval = require('../uneval.js');
var Iterable = jsenv.Iterable;

function normalizePath(path) {
    return path.replace(/\\/g, '/');
}

var rootFolder = normalizePath(path.resolve(__dirname, '../../'));
var cacheFolder = rootFolder + '/cache';
var builderCacheFolder = cacheFolder + '/builder';
var builderCache = store.fileSystemCache(builderCacheFolder);

function generateSourceImporting(objects) {
    var instructions = [];
    function createInstruction(name, from) {
        return {
            namedImports: [
                {
                    name: name,
                    as: null
                }
            ],
            from: from,
            findNamedImport: function(name) {
                return Iterable.find(this.namedImports, function(namedImport) {
                    return namedImport.name === name;
                });
            },
            addNamedImport: function(name) {
                var existing = this.findNamedImport(name);
                if (existing) {
                    throw new Error(
                        'duplicate import ' + name + ' from ' + this.from
                    );
                }

                this.namedImports.push({
                    name: name,
                    as: null
                });
            },
            toSource: function() {
                var source = 'import {';
                source += this.namedImports.map(function(namedImport) {
                    var namedImportSource = '';
                    namedImportSource += namedImport.name;
                    if (namedImport.as) {
                        namedImportSource += ' as ' + namedImport.as;
                    }
                    return namedImportSource;
                }).join(', ');
                source += '}';
                source += ' from ';
                source += "'" + this.from + "'";
                source += ';';
                return source;
            }
        };
    }
    var propertyInstructionsMap = [];
    objects.forEach(function(object) {
        Object.keys(object).forEach(function(propertyName) {
            var propertyImport = object[propertyName];

            var existingInstruction = Iterable.find(instructions, function(instruction) {
                return instruction.from === propertyImport.from;
            });
            if (existingInstruction) {
                existingInstruction.addNamedImport(propertyImport.name);
                propertyInstructionsMap.push({
                    object: object,
                    property: propertyName,
                    instruction: existingInstruction
                });
            } else {
                var instruction = createInstruction(propertyImport.name, propertyImport.from);
                propertyInstructionsMap.push({
                    object: object,
                    property: propertyName,
                    instruction: instruction
                });
                instructions.push(instruction);
            }
        });
    });
    // set a unique variable name for every import
    // to prevent clash and allow collecting thoose variable later
    var id = 0;
    instructions.forEach(function(instruction) {
        instruction.namedImports.forEach(function(namedImport) {
            id++;
            namedImport.as = namedImport.name + '$' + id;
        });
    });

    function getObjectPropertyVariableName(object, property) {
        var foundData = Iterable.find(propertyInstructionsMap, function(data) {
            return (
                data.object === object &&
                data.property === property
            );
        });
        var instruction = foundData.instruction;
        var importName = object[property].name;
        var namedImport = instruction.findNamedImport(importName);
        if (!namedImport) {
            throw new Error('cannot find named import ' + importName + ' of property ' + property);
        }
        return namedImport.as;
    }

    function generateImportSource() {
        return instructions.map(function(instruction) {
            return instruction.toSource();
        }).join('\n');
    }
    function generateCollectorSources() {
        return objects.map(function(object) {
            var objectSource = '{';
            objectSource += Object.keys(object).map(function(key) { // eslint-disable-line
                return '"' + key + '": ' + getObjectPropertyVariableName(object, key);
            }).join(', ');
            objectSource += '}';
            return 'collect(' + objectSource + ');';
        }).join('\n');
    }

    return (
        generateImportSource() +
        '\n\n' +
        'var collector = [];\n' +
        'function collect(a) {\n' +
        '   collector.push(a);\n' +
        '}' +
        '\n' +
        generateCollectorSources() +
        '\n' +
        'export default collector;'
    );
}
// console.log(
//     generateSourceImporting(
//         [
//             {
//                 foo: {
//                     name: 'default',
//                     from: './foo.js'
//                 },
//                 bar: {
//                     name: 'default',
//                     from: './bar.js',
//                 },
//                 baz: {
//                     name: 'filename',
//                     from: './bar.js'
//                 }
//             }
//         ]
//     )
// );

function pickImports(importDescription, options) {
    options = options || {};
    var root = options.root;
    var transpiler = options.transpiler;
    var mainExportName = options.mainExportName || 'default';

    return builderCache.match({
        imports: importDescription,
        root: root,
        main: mainExportName
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
        var moduleSource = generateSourceImporting(importDescription, root);
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
                        path.resolve(root, './detect-helpers.js')
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
                            });
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
