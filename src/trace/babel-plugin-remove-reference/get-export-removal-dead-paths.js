/*
scope : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js
binding : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/binding.js
path : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/path/index.js
ast explorer : https://astexplorer.net/
les tests qu'il faudra passer : https://github.com/rollup/rollup/blob/master/test/function/bindings/foo.js

// l'idée en fait serais de détecter les dépendances
// chose qu'on a pas du tout actuellement
// l'idée c'est que j'ai des pointeurs globaux
// qui peuvent avoir des dépendances entre eux
// grace au références je suis capable de savoir ça
// en fait on se fous de .references
// par contre en utilisant ça + getMostSuperficialPath
// on peut savoir si cette référence appartient à un autre globalBinding
// et donc exprimé une dépendance entre deux pointeur globaux
// et c'est CA qu'on veut

*/

const convertNodeToHumanString = (node) => {
    var humanString = ''
    var type = node.type

    humanString = ''
    if (type === 'VariableDeclarator') {
        humanString += 'variable ' + convertNodeToHumanString(node.id)
    }
    else if (type === 'VariableDeclaration') {
        humanString += node.declarations.map((declaration) => (
            convertNodeToHumanString(declaration.id)
        ))
    }
    else if (type === 'ExportDefaultDeclaration') {
        humanString += 'export default ' + convertNodeToHumanString(node.declaration)
    }
    else if (type === 'ExportNamedDeclaration') {
        if (node.declaration) {
            humanString += 'export {' + convertNodeToHumanString(node.declaration) + '}'
        }
        else {
            humanString += 'export {' + node.specifiers.map(convertNodeToHumanString) + '}'
        }
    }
    else if (type === 'ExportSpecifier') {
        humanString += 'specifier ' + convertNodeToHumanString(node.local)
    }
    else if (type === 'Identifier') {
        humanString = 'identifier ' + node.name
    }
    else if (type === 'FunctionDeclaration') {
        humanString += 'function ' + convertNodeToHumanString(node.id)
    }
    return humanString
}
function log() {
    const args = Array.prototype.slice.call(arguments)
    const formattedArgs = args.map((arg) => {
        if (typeof arg === 'object') {
            var node
            if ('node' in arg) {
                node = arg.node
            }
            else if ('path' in arg) {
                node = arg.path.node
            }
            else if ('type' in arg) {
                node = arg
            }

            if (node) {
                return convertNodeToHumanString(node)
            }
        }
        return arg
    })

    console.log.apply(console, formattedArgs)
}

const getExportRemovalDeadPaths = (rootPath, state, exportNamesToRemove) => {
    var deadPaths = []

    const nameWillBeRemoved = (name) => {
        return exportNamesToRemove.indexOf(name) > -1
    }
    const getStatus = (path) => {
        var i = 0
        var j = deadPaths.length
        var status = 'alive'
        while (i < j) {
            var deadPath = deadPaths[i]
            if (path === deadPath) {
                status = 'dead'
                break
            }
            // https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/path/ancestry.js#L188
            if (path.isDescendant(deadPath)) {
                status = 'dead-by-inheritance'
                break
            }
            i++
        }
        return status
    }
    const isDead = (path) => {
        return getStatus(path) !== 'alive'
    }
    const markAsDead = (path) => {
        var status = getStatus(path)
        if (status === 'dead') {
            log(path, 'already marked as dead')
            return false
        }
        if (status === 'dead-by-inheritance') {
            log(path, 'already dead by ancestor')
            return false
        }
        // supprime les noeuds dead lorsqu'ils sont
        // à l'intérieur d'un path lui même dead
        deadPaths = deadPaths.filter(function(deadPath) {
            var isDescendant = deadPath.isDescendant(path)
            if (isDescendant) {
                log(
                    'exclude', deadPath,
                    'because inside', path
                )
            }
            return isDescendant === false
        })
        deadPaths.push(path)
        log(path, 'marked as dead')
        return true
    }
    /*
    on veut récuperer le scope le plus proche de program ou program
    // https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js#L817
    */
    const createPointers = () => {
        const pointers = []
        const createPointer = (path) => {
            const pointer = {
                path: path,
                references: []
            }
            return pointer
        }
        const findPointer = (path) => pointers.find((pointer) => pointer.path === path)
        const addPointer = (path) => {
            const existingPointer = findPointer(path)
            if (existingPointer) {
                return existingPointer
            }
            const pointer = createPointer(path)
            pointers.push(pointer)
            return pointer
        }
        const rootScope = rootPath.scope
        const bindings = rootScope.getAllBindings()

        Object.keys(bindings).map((name) => {
            const binding = bindings[name]
            const path = binding.path
            // const scope = path.scope
            const pointer = addPointer(path)
            binding.referencePaths.forEach((referencePath) => {
                pointer.references.push(referencePath)
                log(pointer, 'is referenced by', referencePath)
            })
            return pointer
        })

        return pointers
    }
    const pointers = createPointers()
    const getExportInstruction = (path) => {
        var parentPath = path.parentPath
        var parentNode = parentPath.node
        if (parentNode.type === 'ExportNamedDeclaration') {
            return parentPath
        }
        return null
    }
    const weak = (reason) => {
        return {type: 'weak', reason: reason}
    }
    const strong = (reason) => {
        return {type: 'strong', reason: reason}
    }
    // https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js#L817
    const getMostSuperficialScope = (scope) => {
        var mostSuperficialScope = scope
        var previousValidScope = null
        var scopeOrAncestor = scope
        while (scopeOrAncestor) {
            if (scopeOrAncestor.path.isProgram()) {
                mostSuperficialScope = previousValidScope || scopeOrAncestor
                break
            }
            else if (scopeOrAncestor.path.isBlockParent()) {
                previousValidScope = scopeOrAncestor
                mostSuperficialScope = scopeOrAncestor
            }
            scopeOrAncestor = scopeOrAncestor.parent
        }
        return mostSuperficialScope
    }
    const getMostSuperficialPath = (path) => getMostSuperficialScope(path.scope).path
    const getPathStatus = (path) => {
        if (isDead(path)) {
            return weak('path-marked-as-dead')
        }

        const node = path.node
        if (node.type === 'ExportDefaultDeclaration') {
            if (nameWillBeRemoved('default')) {
                return weak('export-default-is-dead')
            }
            return strong('export-default-is-alive')
        }
        if (node.type === 'ExportNamedDeclaration') {
            var declaration = node.declaration
            if (declaration) {
                if (declaration.type === 'VariableDeclaration') {
                    if (nameWillBeRemoved(declaration.declarations[0].id.name)) {
                        return weak('export-declared-variable-is-dead')
                    }
                    return strong('export-declared-variable-is-alive')
                }
                if (declaration.type === 'FunctionDeclaration') {
                    if (nameWillBeRemoved(node.declaration.id.name)) {
                        return weak('export-declared-function-is-dead')
                    }
                    return strong('export-declared-function-is-alive')
                }
            }
            return strong('export-named-is-alive')
        }
        if (node.type === 'ExportSpecifier') {
            if (nameWillBeRemoved(node.local.name)) {
                return weak('export-specifier-is-dead')
            }
            return strong('export-specifier-is-alive')
        }
        if (node.type === 'VariableDeclarator') {
            var declarationPath = path.parentPath
            var exportPath = getExportInstruction(declarationPath)
            if (exportPath) {
                if (nameWillBeRemoved(node.id.name)) {
                    return weak('variable-export-is-dead')
                }
                return strong('variable-export-is-alive')
            }
            return strong('variable')
            // const mostSuperficialScope = getMostSuperficialScope(path)
            // return getPathStatus()
        }
        if (node.type === 'FunctionDeclaration') {
            const mostSuperficialPath = getMostSuperficialPath(path)
            // global function
            if (mostSuperficialPath === path) {
                var functionExportPath = getExportInstruction(path)
                if (functionExportPath) {
                    if (nameWillBeRemoved(node.id.name)) {
                        return weak('function-export-is-dead')
                    }
                    return strong('function-export-is-alive')
                }
                // if the function is not exported it's supposed to be dead
                // but preserve them for now
                return strong('function-global-not-exported')
            }
            return getPathStatus(mostSuperficialPath)
        }

        return strong('strong-by-default')
    }

    pointers.forEach((pointer) => {
        var pathStatus = getPathStatus(pointer.path)
        if (pathStatus.type === 'strong') {
            log(pointer, 'cannot be killed because', pathStatus.reason)
            return false
        }

        const references = pointer.references
        const strongReference = references.find((reference) => {
            return getPathStatus(reference).type === 'strong'
        })
        if (strongReference) {
            log(
                pointer, 'alive by reference',
                strongReference, 'which is alive because', getPathStatus(strongReference).reason
            )
            return false
        }

        markAsDead(pointer.path)
    })

    return deadPaths
}

module.exports = getExportRemovalDeadPaths

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
