/*
En rendant ça récursif en lisant ce qu'on trouve là ou c'est importé
on peut récup la liste des dépendances
il faudrais aussi pouvoir passer un locate custom
*/

var babel = require('babel-core');
var path = require('path');
var fs = require('fs');

var find = require('./find.js');

var visitors = [
    function(node) {
        return node.type === 'ImportDeclaration';
    },
    function transformImportDeclarationToDependency(node) {
        var source = node.source;
        var specifiers = node.specifiers;
        var members = specifiers.map(function(specifier) { // eslint-disable-line
            if (specifier.type === 'ImportSpecifier') {
                return {
                    name: specifier.local.name,
                    as: specifier.imported ? specifier.imported.name : null
                };
            }
            if (specifier.type === 'ImportDefaultSpecifier') {
                return {
                    name: 'default',
                    as: specifier.local.name
                };
            }
            if (specifier.type === 'ImportNamespaceSpecifier') {
                return {
                    name: '*',
                    as: specifier.local.name
                };
            }
        });
        return {
            path: source.value,
            members: members
        };
    },

    function(node) {
        return node.type === 'ExportNamedDeclaration';
    },
    function transformExportNamedDeclarationToDependency(node) {
        var source = node.source;

        if (source) {
            var specifiers = node.specifiers;
            var members = specifiers.map(function(specifier) { // eslint-disable-line
                if (specifier.type === 'ExportSpecifier') {
                    return {
                        name: specifier.local.name,
                        as: specifier.exported ? specifier.exported.name : null
                    };
                }
            });
            return {
                path: source.value,
                members: members
            };
        }
    },

    function(node) {
        return node.type === 'ExportAllDeclaration';
    },
    function transformExportAllDeclarationToDependency(node) {
        var source = node.source;
        if (source) {
            return {
                path: source.value,
                members: [
                    {
                        name: '*',
                        as: null
                    }
                ]
            };
        }
    }
];
function visit(node) {
    var i = 0;
    var j = visitors.length;
    var result;
    while (i < j) {
        var visitWhen = visitors[i];
        if (visitWhen(node)) {
            i++;
            result = visitors[i](node);
            break;
        }
        i += 2;
    }
    return result;
}
function fetch(filename) {
    return new Promise(function(resolve, reject) {
        return fs.readFile(filename, function(error, buffer) {
            if (error) {
                reject(error);
            } else {
                resolve(buffer.toString());
            }
        });
    });
}
function parseAst(code) {
    return babel.transform(code, {
        ast: true,
        code: false,
        babelrc: false,
        sourceMaps: false
    }).ast;
}
function fetchAst(filename) {
    // console.log('fetching', filename);
    return fetch(filename).then(parseAst);
}
function normalize(path) {
    return path.replace(/\\/g, '/');
}

function readDependencies(filenames, options) {
    options = options || {};
    var autoParentDependency = options.autoParentDependency;
    var exclude = options.exclude || function() {
        return false;
    };
    var root = options.root || process.cwd();

    function resolve(importee, importer, rootImporter) {
        if (importee.slice(0, 2) === '//') {
            return path.resolve(process.cwd(), importee.slice(2));
        }
        if (importee[0] === '/') {
            return path.resolve(rootImporter, importee.slice(1));
        }
        if (importee.slice(0, 2) === './' || importee.slice(0, 3) === '../') {
            if (importer) {
                if (importer === rootImporter) {
                    return path.resolve(rootImporter, importee);
                }
                return path.resolve(path.dirname(importer), importee);
            }
            return path.resolve(process.cwd(), importee);
        }
        if (importer) {
            return path.resolve(importer, importee);
        }
        return path.resolve(process.cwd(), importee);
    }
    function locate() {
        var location = resolve.apply(this, arguments);
        // console.log(
        //     'locate',
        //     arguments[0],
        //     '->',
        //     location,
        //     'from',
        //     arguments[1]
        // );
        return location;
    }
    function filterDependencies(dependencies) {
        return Promise.all(
            dependencies.map(function(dependency) {
                return Promise.resolve(exclude(dependency.id)).then(function(isExcluded) {
                    return isExcluded ? null : dependency;
                });
            })
        ).then(function(dependencies) {
            return dependencies.filter(function(dependency) {
                return Boolean(dependency);
            });
        });
    }
    function findById(modules, id) {
        return find(modules, function(module) {
            return module.id === id;
        });
    }

    return Promise.resolve(
        locate(root, null, null)
    ).then(function(location) {
        var rootId = normalize(location);

        return Promise.all(filenames.map(function(filename) {
            return locate(filename, rootId, rootId);
        })).then(function(locations) {
            var promisesMap = {};
            var modules = [];
            function createModule(id) {
                var existingModule = findById(modules, id);
                if (existingModule) {
                    return existingModule;
                }
                var module = {
                    id: id,
                    dependencies: []
                };
                modules.push(module);
                return module;
            }
            var fileModules = locations.map(function(location) {
                return createModule(normalize(location));
            });
            function getDependenciesFromAst(module, ast) {
                var nodes = ast.program.body;

                return nodes.map(function(node) {
                    return visit(node);
                }).filter(function(result) {
                    return Boolean(result);
                }).map(function(dependencyMeta) {
                    var dependencyId = normalize(locate(dependencyMeta.path, module.id, rootId));
                    return createModule(dependencyId);
                });
            }
            function fetchModules(modules) {
                return Promise.all(modules.map(function(module) {
                    return fetchModule(module);
                }));
            }
            function fetchModule(module) {
                var fetchPromise;

                if (module in promisesMap) {
                    fetchPromise = promisesMap[module.id];
                } else {
                    fetchPromise = Promise.resolve(
                        fetchAst(module.id)
                    ).then(function(ast) {
                        var astDependencies = getDependenciesFromAst(module, ast);
                        var dependencies = astDependencies.slice();
                        return Promise.resolve(
                            autoParentDependency ? autoParentDependency(module.id, rootId) : null
                        ).then(function(parentDependencyId) {
                            if (parentDependencyId) {
                                parentDependencyId = normalize(parentDependencyId);
                                var astParentDependency = findById(astDependencies, parentDependencyId);
                                if (astParentDependency) {
                                    // console.log('parent dependency already declared in', module.id);
                                } else {
                                    // console.log('auto add', parentDependencyId, 'to', module.id);
                                    dependencies.push(
                                        createModule(parentDependencyId)
                                    );
                                }
                            }
                            return dependencies;
                        });
                    }).then(function(dependencies) {
                        return filterDependencies(dependencies).then(function(dependencies) {
                            module.dependencies = dependencies;
                            // console.log('the dependencies of', module.id, module.dependencies);
                            return fetchModules(dependencies);
                        });
                    });
                    promisesMap[module.id] = fetchPromise;
                }

                return fetchPromise;
            }

            return Promise.all(fileModules.map(function(module) {
                return fetchModule(module);
            })).then(function() {
                return fileModules;
            });
        });
    });
}

module.exports = readDependencies;

// readDependencies(
//     [
//         './a/entry.js',
//         './b/entry.js',
//         './d/entry.js',
//         './a/first/entry.js',
//         './c/second/entry.js'
//     ],
//     {
//         root: './modules'
//     }
// ).then(function(dependencies) {
//     console.log(dependencies);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

