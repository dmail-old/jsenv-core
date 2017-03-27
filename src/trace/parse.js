var babel = require('babel-core');
var fs = require('fs');

var find = require('../api/util/find.js');
var mapAsync = require('../api/util/map-async.js');
var resolveIfNotPlain = require('./resolve-if-not-plain.js');
var root = require('path').resolve(process.cwd(), '../../').replace(/\\/g, '/');
var rootHref = 'file:///' + root;

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
function readSource(filename) {
    filename = getNodeFilename(filename);
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
function normalize(path) {
    return path.replace(/\\/g, '/');
}

function parse(entryRelativeHref, absoluteRootHref, options) {
    options = options || {};
    absoluteRootHref = absoluteRootHref || rootHref;
    var variables = options.variables || {};
    var fetch = options.fetch || function(path, readSource) {
        return readSource(path);
    };
    // ensure trailing / so that we are absolutely sur it's a folder
    if (absoluteRootHref[absoluteRootHref.length - 1] !== '/') {
        absoluteRootHref += '/';
    }
    var baseHref = absoluteRootHref.slice(0, absoluteRootHref.lastIndexOf('/'));

    function resolve(importee, importer) {
        var resolved = resolveIfNotPlain(importee, importer);
        if (resolved) {
            return resolved;
        }
        return baseHref + '/' + importee;
    }
    function locate() {
        var absoluteHref = resolve.apply(this, arguments);
        // console.log(
        //     'locate',
        //     arguments[0],
        //     '->',
        //     absoluteHref,
        //     'from',
        //     arguments[1]
        // );
        return normalize(absoluteHref);
    }

    var nodes = [];
    function findById(id) {
        return find(nodes, function(node) {
            return node.id === id;
        });
    }
    function createNode(href) {
        var id = href.slice(absoluteRootHref.length);

        var existingNode = findById(id);
        if (existingNode) {
            return existingNode;
        }
        var node = {
            id: id,
            path: href,
            importations: [],
            dependencies: [],
            dependents: []
        };
        nodes.push(node);
        return node;
    }
    function getDependenciesFromAst(node, ast) {
        var astNodes = ast.program.body;

        return astNodes.map(function(astNode) {
            return visit(astNode);
        }).filter(function(result) {
            return Boolean(result);
        });
    }
    function transform(code) {
        return babel.transform(code, {
            ast: true,
            code: false,
            sourceMaps: false,
            babelrc: false,
            plugins: []
        });
    }
    function fetchAndTransform(node) {
        // console.log('fetching', node.id);
        return Promise.resolve(fetch(node.path, readSource)).then(transform);
    }

    var parseCache = {};
    function parseNode(node) {
        var promise;

        if (node.id in parseCache) {
            promise = parseCache[node.id];
        } else {
            promise = Promise.resolve(
                fetchAndTransform(node)
            ).then(function(result) {
                var astDependencies = getDependenciesFromAst(node, result.ast).map(function(astDependency) {
                    astDependency.path = astDependency.path.replace(/\$\{([^{}]+)\}/g, function(match, name) {
                        if (name in variables) {
                            return variables[name];
                        }
                        return match;
                    });
                    return astDependency;
                });
                var dependencies = astDependencies.map(function(astDependency) {
                    var dependencyHref = locate(astDependency.path, node.path);
                    var dependencyNode = createNode(dependencyHref);
                    return dependencyNode;
                });
                dependencies.forEach(function(dependency, index) {
                    var dependencyIndex = node.dependencies.indexOf(dependency);
                    if (dependencyIndex === -1) {
                        node.dependencies.push(dependency);
                        node.importations.push([]);
                    }

                    if (dependency.dependents.indexOf(node) === -1) {
                        dependency.dependents.push(node);
                    }

                    var astDependency = astDependencies[index];
                    var importations = node.importations[index];
                    var members = astDependency.members;
                    members.forEach(function(member) {
                        var memberName = member.name;
                        if (memberName) {
                            if (importations.indexOf(memberName) === -1) {
                                importations.push(memberName);
                            }
                        }
                    });
                });

                return mapAsync(node.dependencies, parseNode).then(function() {
                    return node;
                });
            });
            parseCache[node.id] = promise;
        }

        return promise;
    }

    return Promise.resolve(locate(entryRelativeHref, absoluteRootHref)).then(function(entryHref) {
        var entryNode = createNode(entryHref);
        return parseNode(entryNode).then(function() {
            return {
                locate: locate,
                fetch: function(node) {
                    return fetch(node.path, readSource);
                },
                root: entryNode
            };
        });
    });
}

module.exports = parse;

// parse(
//     'examples/entry.js',
//     rootHref,
//     {
//         variables: {
//             platform: 'node'
//         }
//     }
// ).then(function(tree) {
//     console.log('tree', tree);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

