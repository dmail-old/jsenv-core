/*
scope : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js
binding : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/binding.js
path : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/path/index.js
ast explorer : https://astexplorer.net/
les tests qu'il faudra passer : https://github.com/rollup/rollup/blob/master/test/function/bindings/foo.js
*/

function convertNodeToHumanString(node) {
    var humanString = '';
    var type = node.type;

    humanString = '';
    if (type === 'VariableDeclarator') {
        humanString += convertNodeToHumanString(node.id);
    } else if (type === 'VariableDeclaration') {
        humanString += node.declarations.map(function(declaration) {
            return convertNodeToHumanString(declaration.id);
        });
    } else if (type === 'ExportDefaultDeclaration') {
        humanString += 'export default ' + convertNodeToHumanString(node.declaration);
    } else if (type === 'ExportNamedDeclaration') {
        if (node.declaration) {
            humanString += 'export {' + convertNodeToHumanString(node.declaration) + '}';
        } else {
            humanString += 'export {' + node.specifiers.map(convertNodeToHumanString) + '}';
        }
    } else if (type === 'ExportSpecifier') {
        humanString += convertNodeToHumanString(node.local);
    } else if (type === 'Identifier') {
        humanString = node.name;
    } else if (type === 'FunctionDeclaration') {
        humanString += convertNodeToHumanString(node.id);
    }
    return humanString;
}
function log() {
    var args = Array.prototype.slice.call(arguments);
    args = args.map(function(arg) {
        var node;
        if (arg.node) {
            node = arg.node;
        }
        if (arg.path) {
            node = arg.path.node;
        }

        if (node) {
            return convertNodeToHumanString(node);
        }
        return arg;
    });
    console.log.apply(console, args);
}

function getExportRemovalDeadPaths(path, state, exportNamesToRemove) {
    var deadPaths = [];

    function nameWillBeRemoved(name) {
        return exportNamesToRemove.indexOf(name) > -1;
    }
    function isDescendantOf(path, possibleAncestorPath) {
        var parentOrAncestorPath = path.parentPath;
        while (parentOrAncestorPath) {
            if (parentOrAncestorPath === possibleAncestorPath) {
                return true;
            }
            parentOrAncestorPath = parentOrAncestorPath.parentPath;
        }
        return false;
    }
    function getStatus(path) {
        var i = 0;
        var j = deadPaths.length;
        var status = 'alive';
        while (i < j) {
            var deadPath = deadPaths[i];
            if (path === deadPath) {
                status = 'dead';
                break;
            }
            if (isDescendantOf(path, deadPath)) {
                status = 'dead-by-inheritance';
                break;
            }
            i++;
        }
        return status;
    }
    function isDead(path) {
        return getStatus(path) !== 'alive';
    }
    function markAsDead(path) {
        var status = getStatus(path);
        if (status === 'dead') {
            log(path, 'already marked as dead');
            return false;
        }
        if (status === 'dead-by-inheritance') {
            log(path, 'already dead by ancestor');
            return false;
        }
        // supprime les noeuds dead lorsqu'ils sont
        // à l'intérieur d'un path lui même dead
        deadPaths = deadPaths.filter(function(deadPath) {
            var isDescendant = isDescendantOf(deadPath, path);
            if (isDescendant) {
                log(
                    'exclude', deadPath,
                    'because inside', path
                );
            }
            return isDescendant === false;
        });
        deadPaths.push(path);
        log(path, 'marked as dead');
        return true;
    }
    function createGraph() {
        var scope = path.scope;
        var bindings = scope.getAllBindings();
        var pointers = [];
        function createPointer(path) {
            var pointer = pointers.find(function(pointer) {
                return pointer.path === path;
            });
            if (pointer) {
                return pointer;
            }
            pointer = {
                path: path,
                dependencies: [],
                dependents: []
            };
            pointers.push(pointer);
            return pointer;
        }
        function getPathOwner(path) {
            var node = path.node;
            if (node.type === 'Identifier') {
                return path.parentPath;
            }
            return path;
        }
        function getGlobalPathOwner(path) {
            var currentPath = getPathOwner(path);
            var currentScope = path.scope;
            while (currentScope !== scope) {
                currentPath = getPathOwner(currentPath.parentPath);
                if (!currentPath) {
                    throw new Error('cannot find a shared scope');
                }
                currentScope = currentPath.scope;
            }
            return currentPath;
        }
        var globalPointers = Object.keys(bindings).map(function(name) {
            var binding = bindings[name];
            var pointer = createPointer(binding.path);

            pointer.identifier = binding.identifier;
            binding.referencePaths.forEach(function(referencePath) {
                var dependentPath = getGlobalPathOwner(referencePath);

                if (dependentPath) {
                    var dependent = createPointer(dependentPath);
                    pointer.dependents.push(dependent);
                    dependent.dependencies.push(pointer);
                    // log(dependent, 'depends on', pointer);
                }
            });

            return pointer;
        });

        return globalPointers;
    }
    function markPointerAsDead(pointer) {
        markAsDead(pointer.path);
        // when path is marked as dead it means we don't care about dependents anymore
        // but dependencies may not be elligible for dead mark
        pointer.dependents.forEach(function(dependent) {
            visitPointer(dependent);
        });
        pointer.dependencies.forEach(function(dependency) {
            visitPointer(dependency);
        });
    }
    function isPointerKillable(pointer) {
        function getExportInstruction(path) {
            var parentPath = path.parentPath;
            var parentNode = parentPath.node;
            if (parentNode.type === 'ExportNamedDeclaration') {
                return parentPath;
            }
            return null;
        }
        function weak(reason) {
            return {type: 'weak', reason: reason};
        }
        function strong(reason) {
            return {type: 'strong', reason: reason};
        }
        function getPointerStatus(pointer) {
            var path = pointer.path;
            if (isDead(path)) {
                return weak('path-marked-as-dead');
            }

            var node = path.node;
            if (node.type === 'ExportDefaultDeclaration') {
                // var declaration = dependentNode.declaration;
                if (nameWillBeRemoved('default')) {
                    return weak('export-default-is-dead');
                }
                return strong('export-default-is-alive');
            }
            if (node.type === 'ExportNamedDeclaration') {
                var declaration = node.declaration;
                if (declaration) {
                    if (declaration.type === 'VariableDeclaration') {
                        if (nameWillBeRemoved(declaration.declarations[0].id.name)) {
                            return weak('export-declared-variable-is-dead');
                        }
                        return strong('export-declared-variable-is-alive');
                    }
                    if (declaration.type === 'FunctionDeclaration') {
                        if (nameWillBeRemoved(node.declaration.id.name)) {
                            return weak('export-declared-function-is-dead');
                        }
                        return strong('export-declared-function-is-alive');
                    }
                }
                return weak('export-named-is-alive');
            }
            if (node.type === 'ExportSpecifier') {
                if (nameWillBeRemoved(node.local.name)) {
                    return weak('export-specifier-is-dead');
                }
                return strong('export-specifier-is-alive');
            }
            if (node.type === 'VariableDeclarator') {
                var declarationPath = path.parentPath;
                var exportPath = getExportInstruction(declarationPath);
                if (exportPath) {
                    if (nameWillBeRemoved(node.id.name)) {
                        return weak('variable-export-is-dead');
                    }
                    return strong('variable-export-is-alive');
                }
                if (pointer.identifier) {
                    return weak('global-variable-not-exported');
                }
                return strong('local-variable-is-strong');
            }
            if (node.type === 'FunctionDeclaration') {
                var functionPath = path.parentPath;
                var functionExportPath = getExportInstruction(functionPath);
                if (functionExportPath) {
                    if (nameWillBeRemoved(node.id.name)) {
                        return weak('function-export-is-dead');
                    }
                    return strong('function-export-is-alive');
                }
                if (pointer.identifier) {
                    return weak('global-function-not-exported');
                }
                return strong('local-function-is-strong');
            }
            return strong('strong-by-default');
        }

        var referenceStatus = getPointerStatus(pointer);
        if (referenceStatus.type === 'strong') {
            log(pointer, 'cannot be killed because', referenceStatus.reason);
            return false;
        }

        var strongDependent = pointer.dependents.find(function(dependent) {
            return getPointerStatus(dependent).type === 'strong';
        });
        if (strongDependent) {
            log(
                pointer, 'alive by dependent',
                strongDependent, getPointerStatus(strongDependent).reason
            );
            return false;
        }
        var strongDependency = pointer.dependencies.find(function(dependency) {
            return getPointerStatus(dependency).type === 'strong';
        });
        if (strongDependency) {
            log(
                pointer, 'alive by dependency',
                strongDependency, getPointerStatus(strongDependency).reason
            );
            return false;
        }
        return true;
    }
    function visitPointer(pointer) {
        if (isDead(pointer.path)) {
            return;
        }
        // la seule manière qu'un pointeur soit dead c'est qu'il ait dans ses dependents
        // un export qu'on souhait supprimé
        // et rien qu'on ne souhaite garder

        var dependents = pointer.dependents;
        var hasNoDependents = dependents.length === 0;
        if (hasNoDependents) {
            // si pointer.dependents.length === 0
            // il ne "faut pas" supprimer ce noeud parce que même si a priori
            // cela signifique que le noeud n'ets utilisé nul part
            // ça ne fait pas partie de la logique quo'n met en place ici qui est
            // que si le noeud était utilisé par un export il est supprimé
            // mais pas si il n'est pas utilisé du tout
            log(pointer, 'has no dependents');
            var isKillable2 = isPointerKillable(pointer);
            if (isKillable2) {
                markPointerAsDead(pointer);
            }
        } else {
            log(pointer, 'may be dead, check dependents');
            var isKillable = isPointerKillable(pointer);
            if (isKillable) {
                markPointerAsDead(pointer);
            }
        }
    }
    var graph = createGraph();
    graph.forEach(function(pointer) {
        visitPointer(pointer);
    });

    return deadPaths;
}

module.exports = getExportRemovalDeadPaths;

 // path.traverse({
//     ExportDefaultDeclaration: function(path) {
//         // var node = path.node;
//         if (nameWillBeRemoved('default')) {
//             deadPaths.push(path);
//         }
//     },

//     ExportNamedDeclaration: function() {
//         var node = path.node;
//         var declaration = node.declaration;
//         if (declaration) {
//             if (declaration.type === 'FunctionDeclaration') {
//                 var functionIdentifier = declaration.id;
//                 if (nameWillBeRemoved(functionIdentifier.name)) {
//                     deadPaths.push(path);
//                 }
//             }
//             if (declaration.type === 'VariableDeclaration') {
//                 var variableDeclarator = declaration.declarations[0];
//                 if (nameWillBeRemoved(variableDeclarator.id.name)) {
//                     deadPaths.push(variableDeclarator);
//                 }
//             }
//         } else {
//             var specifiers = node.specifiers;
//             specifiers.forEach(function(specifier) {
//                 if (nameWillBeRemoved(specifier.local.name)) {
//                     deadPaths.push(specifier);
//                 }
//             });
//         }
//     }
// }, state);

// graph.forEach(function(pointer) {
//     // il faudra aussi check si tous les pointer.dependents
//     // sont dead ou vont l'être

//     if (exportNamesToRemove.indexOf(pointer.identifier.name) === -1) {
//         console.log(pointer.path.node, 'is alive');
//     } else {
//         console.log(pointer.path.node, 'is dead');
//         markAsDead(pointer.path);
//     }

//     // les exports utilisant les noms spécifié -> à supprimer
//     // les global binding utilisant les noms spécifié -> à supprimé

//     var visitors = {
//         ExportDefaultDeclaration: function(path) {
//             path.traverse(identifierVisitors, {ownerPath: path});
//         },
//         ExportNamedDeclaration: function(path) {
//             path.traverse(identifierVisitors, {ownerPath: path});
//         }
//     };
//     // si le noeud fait parte d'un export -> mark as dead
//     function identifierMustBeRemoved(identifier) {
//         return exportNamesToRemove.indexOf(identifier.name) > -1;
//     }
//     var identifierVisitors = {
//         Identifier: function(path, state) {
//             var identifier = path.node;
//             var ownerPath = state.ownerPath;

//             // var parentPath = path.parentPath;
//             // var parentNode = parentPath.node;
//             // var ownerPath;

//             // if (parentNode.type === 'VariableDeclarator') {
//             //     // console.log('parent is VariableDeclarator');
//             //     // VariableDeclarator is contained by VariableDeclaration which is contained
//             //     // by ExportSpecifier which is contained by ExportNamedDeclaration
//             //     ownerPath = parentPath.parentPath.parentPath;
//             // } else if (parentNode.type === 'FunctionDeclaration') {
//             //     ownerPath = parentPath;
//             // } else if (parentNode.type === 'ExportSpecifier') {
//             //     ownerPath = parentPath;
//             // }
//             // else {
//             //     throw new Error('unknown ownerPath node ' + parentNode);
//             // }
//             if (identifierMustBeRemoved(identifier)) {
//                 markAsDead(ownerPath);
//             }
//         }
//     };
//     pointer.path.traverse(visitors, state);
// });
