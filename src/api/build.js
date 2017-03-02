var Instruction = (function() {
    function preventMembersConflict(id) {
        this.members.forEach(function(member) {
            member.as = member.name + '$' + id;
        });
    }
    function findMember(name) {
        return Iterable.find(this.members, function(member) {
            return member.name === name;
        });
    }
    function addMember(name, propertyName) {
        var existing = this.findMember(name);
        if (existing) {
            throw new Error(
                'duplicate member ' + name + ' for ' + this
            );
        }
        this.members.push({
            name: name,
            property: propertyName,
            as: null
        });
    }

    function DeclareInstruction(from) {
        this.from = from;
        this.members = [];
    }
    DeclareInstruction.prototype = {
        constructor: DeclareInstruction,
        type: 'declare',
        findMember: findMember,
        addMember: addMember,
        preventConflict: function(id) {
            this.name = '$' + id;
            preventMembersConflict.call(this, id);
        },
        toSource: function() {
            var source = 'var ';
            source += this.name;
            source += ' = ';
            source += uneval(this.from);
            source += ';';
            source += '\n';

            var inlineName = this.name;
            source += this.members.map(function(member) {
                var memberSource = '';
                memberSource += 'var ';
                memberSource += member.as;
                memberSource += ' = ';
                memberSource += inlineName;

                var propertyName = member.name;
                if (propertyName) {
                    memberSource += '[' + uneval(propertyName) + ']';
                }
                memberSource += ';';
                return memberSource;
            }).join('\n');

            return source;
        }
    };

    function ImportInstruction(from) {
        this.from = from;
        this.members = [];
    }
    ImportInstruction.prototype = {
        constructor: ImportInstruction,
        type: 'import',
        findMember: findMember,
        addMember: addMember,
        preventConflict: preventMembersConflict,
        toSource: function() {
            var source = 'import {';
            source += this.members.map(function(member) {
                var memberSource = '';
                memberSource += member.name;
                if (member.as) {
                    memberSource += ' as ' + member.as;
                }
                return memberSource;
            }).join(', ');
            source += '}';
            source += ' from ';
            source += "'" + this.from + "'";
            source += ';';
            return source;
        }
    };

    return {
        create: function createInstruction(type, arg) {
            if (type === 'inline') {
                return new DeclareInstruction(arg);
            }
            if (type === 'import') {
                return new ImportInstruction(arg);
            }
        }
    };
})();

var uneval = require('../uneval.js');
require('../jsenv.js');
var Iterable = jsenv.Iterable;
function generateSource(abstractObjects) {
    var instructions = [];
    var links = [];
    abstractObjects.forEach(function(abstractObject) {
        Object.keys(abstractObject).forEach(function(propertyName) {
            var abstractProperty = abstractObject[propertyName];
            var instruction = Iterable.find(instructions, function(instruction) {
                return (
                    instruction.type === abstractProperty.type &&
                    instruction.from === abstractProperty.from
                );
            });
            if (instruction) {

            } else {
                instruction = Instruction.create(abstractProperty.type, abstractProperty.from);
                instructions.push(instruction);
            }
            instruction.addMember(abstractProperty.name, propertyName);
            links.push({
                object: abstractObject,
                property: propertyName,
                instruction: instruction
            });
        });
    });
    // set a unique variable name for every instruction
    // to prevent clash and allow collecting thoose variable later
    var id = 0;
    instructions.forEach(function(instruction) {
        id++;
        instruction.preventConflict(id);
    });

    function generateInstructionSource() {
        return instructions.map(function(instruction) {
            return instruction.toSource();
        }).join('\n');
    }
    function getAbstractObjectVariableNameForProperty(abstractObject, property) {
        var link = Iterable.find(links, function(link) {
            return (
                link.object === abstractObject &&
                link.property === property
            );
        });
        var instruction = link.instruction;
        var abstractProperty = abstractObject[property];
        var member = instruction.findMember(abstractProperty.name);
        if (member) {
            return member.as;
        }
        throw new Error(
            'cannot find named member ' + abstractProperty.name + ' of property ' + property
        );
    }
    function generateCollectorSources() {
        return abstractObjects.map(function(abstractObject) {
            var objectSource = '{';
            objectSource += Object.keys(abstractObject).map(function(key) { // eslint-disable-line
                return '"' + key + '": ' + getAbstractObjectVariableNameForProperty(abstractObject, key);
            }).join(', ');
            objectSource += '}';
            return 'collect(' + objectSource + ');';
        }).join('\n');
    }

    return (
        generateInstructionSource() +
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
//     generateSource(
//         [
//             {
//                 foo: {
//                     type: 'import',
//                     name: 'default',
//                     from: './foo.js'
//                 },
//                 bar: {
//                     type: 'import',
//                     name: 'default',
//                     from: './bar.js'
//                 },
//                 baz: {
//                     type: 'import',
//                     name: 'filename',
//                     from: './bar.js'
//                 },
//                 name: {
//                     type: 'inline',
//                     name: '',
//                     from: 'nammmmme'
//                 }
//             }
//         ]
//     )
// );

var rollup = require('rollup');
var path = require('path');
var store = require('../store.js');
var memoize = require('../memoize.js');

function normalizePath(path) {
    return path.replace(/\\/g, '/');
}

var rootFolder = normalizePath(path.resolve(__dirname, '../../'));
var cacheFolder = rootFolder + '/cache';
var builderCacheFolder = cacheFolder + '/builder';
var builderCache = store.fileSystemCache(builderCacheFolder);

function buildSource(abstractObjects, options) {
    options = options || {};
    var root = options.root;
    var transpiler = options.transpiler;
    var mainExportName = options.mainExportName || 'default';
    var exportsName = options.exportsName || '__exports__';

    return builderCache.match({
        abstracts: abstractObjects,
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

    function build() {
        var moduleSource = generateSource(abstractObjects, root);
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
                                });
                            }
                        }
                    }
                }
            ]
        }).then(function(bundle) {
            var footer = exportsName + ';';
            if (options.footer) {
                footer += '\n' + options.footer;
            }

            var result = bundle.generate({
                format: 'iife',
                // because we can't be sure people will use 'use strict' so consider the worts scenario
                // the one where they don't have use strict
                useStrict: false,
                moduleName: exportsName,
                indent: true,
                exports: 'named',
                banner: 'var ' + exportsName + '= {};',
                // intro: '"intro";',
                outro: (
                    exportsName + '[' + uneval(mainExportName) + '] = collector;\n' +
                    exportsName + '.meta = ' + uneval(options.meta || {}) + ';'
                ),
                footer: footer
            });
            return result.code;
        });
    }
}

function build(abstractFeatures, options) {
    return buildSource(abstractFeatures, {
        root: options.root,
        transpiler: options.transpiler,
        meta: options.meta,
        mainExportName: 'features',
        load: options.load,
        footer: options.footer
    }).then(function(source) {
        return {
            source: source,
            compile: function() {
                return eval(source);
            }
        };
    });
}

module.exports = build;
