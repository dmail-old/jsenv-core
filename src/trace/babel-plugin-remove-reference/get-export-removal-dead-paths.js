/*
scope : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js
binding : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/binding.js
path : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/path/index.js
ast explorer : https://astexplorer.net/
les tests qu'il faudra passer : https://github.com/rollup/rollup/blob/master/test/function/bindings/foo.js

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
    else {
        humanString += type
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

    const isGlobalVariableDeclarator = (path) => {
        if (path.isVariableDeclarator() === false) {
            return false
        }
        const variableDeclaration = path.parentPath
        const variableDeclarationParent = variableDeclaration.parentPath
        if (variableDeclarationParent.isProgram()) {
            return true
        }
        if (variableDeclarationParent.isExportNamedDeclaration()) {
            return true
        }
        return false
    }
    const isGlobalFunctionDeclaration = (path) => {
        if (path.isFunctionDeclaration() === false) {
            return false
        }
        const parent = path.parentPath
        if (parent.isProgram()) {
            return true
        }
        if (parent.isExportNamedDeclaration()) {
            return true
        }
        if (parent.isExportDefaultDeclaration()) {
            return true
        }
        return false
    }
    const getGlobalOwner = (path) => {
        return path.find((pathOrAncestor) => {
            if (pathOrAncestor.parentPath.isProgram()) {
                return true
            }
            if (isGlobalVariableDeclarator(pathOrAncestor)) {
                return true
            }
            if (isGlobalFunctionDeclaration(pathOrAncestor)) {
                return true
            }
            return false
        })
    }
    const createPointers = () => {
        const createPointer = (path) => {
            const pointer = {
                path: path,
                references: [],
                dependencies: [],
                dependents: []
            }
            return pointer
        }
        const rootScope = rootPath.scope
        const bindings = rootScope.getAllBindings()

        const pointers = Object.keys(bindings).map((name) => {
            const binding = bindings[name]
            const path = binding.path
            const pointer = createPointer(path)
            log('global pointer', pointer)
            pointer.references = binding.referencePaths.slice()
            return pointer
        })

        pointers.forEach((pointer) => {
            pointer.references.forEach((reference) => {
                const ownerPath = getGlobalOwner(reference)
                const ownerPointer = pointers.find((pointer) => {
                    return (
                        pointer.path === ownerPath ||
                        ownerPath.isDescendant(pointer.path)
                    )
                })

                if (ownerPointer) {
                    if (pointer === ownerPointer) {
                        log(reference, 'is internal to', pointer)
                    }
                    else {
                        log(ownerPointer, 'depends on', pointer)
                        ownerPointer.dependencies.push(pointer)
                        pointer.dependents.push(ownerPointer)
                    }
                }
                else {
                    // no owner means program is the owner
                    log('no owner for', reference)
                    // console.log('which is inside', reference.parentPath.node)
                }
            })
        })

        return pointers
    }

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
            if (!path.isDescendant) {
                console.log('path', path)
            }
            if (path.isDescendant(deadPath)) {
                status = 'dead-by-ancestor'
                break
            }
            i++
        }
        return status
    }
    const markAsDead = (path) => {
        var status = getStatus(path)
        if (status === 'dead') {
            log(path, 'already marked as dead')
            return false
        }
        if (status === 'dead-by-ancestor') {
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
    const isDead = (path) => {
        return getStatus(path) !== 'alive'
    }
    const weak = (reason) => {
        return {type: 'weak', reason: reason}
    }
    const strong = (reason) => {
        return {type: 'strong', reason: reason}
    }
    const getState = (path) => {
        if (isDead(path)) {
            return weak('path-marked-as-dead')
        }
        if (path.isIdentifier()) {
            return getState(path.parentPath)
        }
        if (path.isExportNamedDeclaration()) {
            const declaration = path.get('declaration')
            if (declaration.isVariableDeclaration()) {
                const firstVariableDeclarator = declaration.get('declarations')[0]
                return getState(firstVariableDeclarator)
            }
            return getState(declaration)
        }
        if (path.isExportDefaultDeclaration()) {
            if (nameWillBeRemoved('default')) {
                return weak('export-default-is-dead')
            }
            return strong('export-default-is-alive')
        }
        if (path.isExportSpecifier()) {
            if (nameWillBeRemoved(path.node.local.name)) {
                return weak('export-specifier-is-dead')
            }
            return strong('export-specifier-is-alive')
        }
        if (path.isVariableDeclarator()) {
            const declarationPath = path.parentPath
            const declarationParentPath = declarationPath.parentPath
            if (declarationParentPath.isExportNamedDeclaration()) {
                if (nameWillBeRemoved(path.node.id.name)) {
                    return weak('export-named-declared-variable-is-dead')
                }
                return strong('export-named-declared-variable-is-alive')
            }
            // const exportDefaultDeclaration = pointer.references.find((reference) => {
            //     return reference.parentPath.isExportDefaultDeclaration()
            // })
            // if (exportDefaultDeclaration) {
            //     if (nameWillBeRemoved('default')) {
            //         return weak('identifier-referenced-by-dead-export-default')
            //     }
            //     return strong('identifier-referenced-by-alive-export-default')
            // }
            return weak('variable')
        }
        if (path.isFunctionDeclaration()) {
            const parentPath = path.parentPath
            if (parentPath.isExportNamedDeclaration()) {
                if (nameWillBeRemoved(path.node.id.name)) {
                    return weak('export-named-declared-function-is-dead')
                }
                return strong('export-named-declared-function-is-alive')
            }
            if (parentPath.isExportDefaultDeclaration()) {
                if (nameWillBeRemoved('default')) {
                    return weak('export-default-declared-function-is-dead')
                }
                return strong('export-default-declared-function-is-alive')
            }
            return weak('function')
        }

        return strong('strong-by-default')
    }
    const isKillable = (pointer) => {
        const state = getState(pointer.path)
        if (state.type === 'strong') {
            log(pointer, 'cannot be killed because', getState.reason)
            return false
        }

        const references = pointer.references
        const strongReference = references.find((reference) => {
            return getState(reference).type === 'strong'
        })
        if (strongReference) {
            log(
                pointer, 'alive by reference',
                strongReference, 'which is alive because', getState(strongReference).reason
            )
            return false
        }

        const dependencies = pointer.dependencies
        const strongDependency = dependencies.find((dependency) => {
            return getState(dependency.path).type === 'strong'
        })
        if (strongDependency) {
            log(
                pointer, 'alive by dependency to',
                strongDependency, 'which is alive because', getState(strongDependency.path).reason
            )
            return false
        }

        // const dependents = pointer.dependencies
        // const strongDependency = dependencies.find((dependency) => {
        //     return getPointerStatus(dependency).type === 'strong'
        // })
        // if (strongDependency) {
        //     log(
        //         pointer, 'alive by dependency to',
        //         strongDependency, 'which is alive because', getPointerStatus(strongDependency).reason
        //     )
        //     return false
        // }
        return true
    }

    const pointers = createPointers()
    pointers.forEach((pointer) => {
        if (isKillable(pointer)) {
            markAsDead(pointer.path)
            // supprime aussi toutes les références qui sont donc dead
            pointer.references.forEach((reference) => {
                markAsDead(reference)
            })
        }
    })

    return deadPaths
}

module.exports = getExportRemovalDeadPaths
