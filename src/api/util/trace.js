/*
En rendant ça récursif en lisant ce qu'on trouve là ou c'est importé
on peut récup la liste des dépendances
il faudrais aussi pouvoir passer un locate custom
*/

var babel = require('babel-core');
var path = require('path');
var fs = require('fs');

var find = require('./find.js');
var mapAsync = require('./map-async.js');

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
        var visitCondition = visitors[i];
        if (visitCondition(node)) {
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
function parse(code) {
    return babel.transform(code, {
        ast: true,
        code: false,
        babelrc: false,
        sourceMaps: false
    });
}
function normalize(path) {
    return path.replace(/\\/g, '/');
}

function trace(filenames, options) {
    options = options || {};
    var autoParentDependency = options.autoParentDependency;
    var exclude = options.exclude || function() {
        return false;
    };
    var root = options.root || process.cwd();
    var fetchFileNode = options.fetch ? function(fileNode) {
        return options.fetch(fileNode, fetch);
    } : function(fileNode) {
        return fetch(fileNode.id);
    };

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
        return normalize(location);
    }
    function filterDependencies(dependencies) {
        return Promise.all(
            dependencies.map(function(dependency) {
                return Promise.resolve(exclude(dependency)).then(function(isExcluded) {
                    return isExcluded ? null : dependency;
                });
            })
        ).then(function(dependencies) {
            return dependencies.filter(function(dependency) {
                return Boolean(dependency);
            });
        });
    }
    function findById(iterable, id) {
        return find(iterable, function(node) {
            return node.id === id;
        });
    }

    return Promise.resolve(
        locate(root, null, null)
    ).then(function(location) {
        var rootId = normalize(location);
        var promisesMap = {};
        var fileNodes = [];

        function createFileNode(id, name) {
            var existingNode = findById(fileNodes, id);
            if (existingNode) {
                return existingNode;
            }
            var fileNode = {
                id: id,
                name: name,
                dependencies: []
            };
            fileNodes.push(fileNode);
            return fileNode;
        }

        return mapAsync(filenames, function(filename) {
            return Promise.resolve(locate(filename, rootId, rootId)).then(function(id) {
                return createFileNode(id, filename);
            });
        }).then(function(idsAsFileNodes) {
            function getDependenciesFromAst(fileNode, ast) {
                var nodes = ast.program.body;

                return nodes.map(function(node) {
                    return visit(node);
                }).filter(function(result) {
                    return Boolean(result);
                }).map(function(dependencyMeta) {
                    var dependencyId = locate(dependencyMeta.path, fileNode.id, rootId);
                    return createFileNode(dependencyId, dependencyMeta.path);
                });
            }
            function traceFileNodes(fileNodes) {
                return mapAsync(fileNodes, traceFileNode);
            }
            function traceFileNode(fileNode) {
                var fetchPromise;
                var id = fileNode.id;

                if (id in promisesMap) {
                    fetchPromise = promisesMap[id];
                } else {
                    fetchPromise = Promise.resolve(
                        fetchFileNode(fileNode)
                    ).then(function(code) {
                        fileNode.source = code;
                        return parse(code);
                    }).then(function(result) {
                        var ast = result.ast;
                        var astDependencies = getDependenciesFromAst(fileNode, ast);
                        var dependencies = astDependencies.slice();
                        return Promise.resolve(
                            autoParentDependency ? autoParentDependency(id, rootId) : null
                        ).then(function(parentDependencyId) {
                            if (parentDependencyId) {
                                parentDependencyId = normalize(parentDependencyId);
                                var astParentDependency = findById(astDependencies, parentDependencyId);
                                if (astParentDependency) {
                                    // console.log('parent dependency already declared in', module.id);
                                } else {
                                    // console.log('auto add', parentDependencyId, 'to', module.id);
                                    // le name doit être relatif genre path.relative(parentDependencyId)
                                    dependencies.push(
                                        createFileNode(parentDependencyId, parentDependencyId)
                                    );
                                }
                            }
                            return dependencies;
                        });
                    }).then(function(dependencies) {
                        return filterDependencies(dependencies).then(function(dependencies) {
                            fileNode.dependencies = dependencies;
                            // console.log('the dependencies of', module.id, module.dependencies);
                            return traceFileNodes(dependencies);
                        });
                    });
                    promisesMap[fileNode.id] = fetchPromise;
                }

                return fetchPromise;
            }

            return mapAsync(idsAsFileNodes, traceFileNode).then(function() {
                return idsAsFileNodes;
            });
        });
    });
}

module.exports = trace;

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

