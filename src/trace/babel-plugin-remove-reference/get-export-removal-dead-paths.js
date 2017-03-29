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
        // when path is marked as dead
        // it may affet dependents & dependencies which
        // may now be dead too
        // pour pointer.dependencies en gros il faut juste check les dependents
        // mais pas le
        pointer.dependents.forEach(function(dependent) {
            visitPointer(dependent);
        });
        pointer.dependencies.forEach(function(dependency) {
            visitPointer(dependency);
        });
    }
    function isPointerKillable(pointer) {
        var path = pointer.path;
        var node = path.node;

        function killable() {
            if (isDead(path)) {
                return true;
            }

            if (node.type === 'ExportDefaultDeclaration') {
                // var declaration = dependentNode.declaration;
                return nameWillBeRemoved('default');
            }
            if (node.type === 'ExportNamedDeclaration') {
                var declaration = node.declaration;
                if (declaration) {
                    if (declaration.type === 'VariableDeclaration') {
                        return nameWillBeRemoved(declaration.declarations[0].id.name);
                    }
                    if (declaration.type === 'FunctionDeclaration') {
                        return nameWillBeRemoved(node.declaration.id.name);
                    }
                }
                return false;
            }
            if (node.type === 'ExportSpecifier') {
                return nameWillBeRemoved(node.local.name);
            }
            return false;
        }

        var can = killable();
        if (can) {
            return pointer.dependents.every(isPointerKillable);
        }
        return false;
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
            // markPointerAsDead(pointer);
        } else {
            log(pointer, 'may be dead, check dependents');

            var aliveDependent = pointer.dependents.find(function(dependent) {
                var dependentPath = dependent.path;
                var dependentIsDead = isDead(dependentPath);
                if (dependentIsDead) {
                    return false;
                }

                var isKillable = isPointerKillable(dependent);
                if (isKillable) {
                    markAsDead(dependent.path);
                    return false;
                }
                return true;
            });

            if (aliveDependent) {
                log(pointer, 'alive by dependent', aliveDependent);
            } else {
                var aliveDependency = pointer.dependencies.find(function(dependency) {
                    var dependencyPath = dependency.path;
                    var dependencyIsDead = isDead(dependencyPath);
                    if (dependencyIsDead) {
                        return false;
                    }

                    var isKillable = isPointerKillable(dependency);
                    if (isKillable) {
                        markAsDead(dependency.path);
                        return false;
                    }
                    return true;
                });
                aliveDependency = null;
                if (aliveDependency) {
                    log(pointer, 'alive by dependency', aliveDependency);
                } else {
                    markPointerAsDead(pointer);
                }
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
