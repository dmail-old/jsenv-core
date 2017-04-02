/*
scope : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js
binding : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/binding.js
path : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/path/index.js
ast explorer : https://astexplorer.net/
les tests qu'il faudra passer : https://github.com/rollup/rollup/blob/master/test/function/bindings/foo.js

penser aussi a getBindingIdentifiers
qui j'ai l'impression retourn tous les identifier utilisé dans un path
mais pes ceux référencés

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
const logEnabled = !true
function log() {
    if (!logEnabled) {
        return
    }
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
    let deadPaths = []

    const nameWillBeRemoved = (name) => {
        return exportNamesToRemove.indexOf(name) > -1
    }
    // special case when export default does not use binding at all (expression)
    if (nameWillBeRemoved('default')) {
        let exportDefaultDeclaration
        rootPath.traverse({
            ExportDefaultDeclaration(path) {
                exportDefaultDeclaration = path
            }
        })
        if (exportDefaultDeclaration) {
            const declaration = exportDefaultDeclaration.get('declaration')
            if (declaration.isExpression() || declaration.isLiteral()) {
                deadPaths.push(exportDefaultDeclaration)
            }
        }
    }
    const weak = (reason) => {
        return {type: 'weak', reason: reason}
    }
    const strong = (reason) => {
        return {type: 'strong', reason: reason}
    }
    const isWeak = (state) => state.type === 'weak'
    const isStrong = (state) => state.type === 'strong'
    const visitors = {
        Program() {
            return weak('weak-when-owned-by-program')
        },
        ExportNamedDeclaration(path) {
            const declaration = path.get('declaration')
            if (declaration) {
                if (declaration.isVariableDeclaration()) {
                    const firstVariableDeclarator = declaration.get('declarations')[0]
                    if (nameWillBeRemoved(firstVariableDeclarator.node.id.name)) {
                        return weak('export-named-declaration-is-dead')
                    }
                    return strong('export-named-declaration-is-alive')
                }
                if (declaration.isFunctionDeclaration()) {
                    if (nameWillBeRemoved(declaration.node.id.name)) {
                        return weak('export-named-declaration-is-dead')
                    }
                    return strong('export-named-declaration-is-alive')
                }
            }
        },
        ExportSpecifier(path) {
            if (nameWillBeRemoved(path.node.local.name)) {
                return weak('export-specifier-is-dead')
            }
            return strong('export-specifier-is-alive')
        },
        ExportDefaultDeclaration() {
            if (nameWillBeRemoved('default')) {
                return weak('export-default-is-dead')
            }
            return strong('export-default-is-alive')
        }
    }
    const isGlobalOwner = (path) => path.node.type in visitors
    const getGlobalOwner = (path) => {
        return path.find((pathOrAncestor) => isGlobalOwner(pathOrAncestor))
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
            // log('global pointer', pointer)
            pointer.references = binding.referencePaths.slice()
            return pointer
        })
        pointers.forEach((pointer) => {
            pointer.references.forEach((reference) => {
                const ownerPointer = pointers.find((possibleOwner) => {
                    return (
                        reference === possibleOwner.path ||
                        reference.isDescendant(possibleOwner.path)
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
                    log(reference, 'owned by program')
                }
                if (pointer) {
                    return true
                }
            })
        })
        return pointers
    }
    const getAliveState = (path) => {
        for (const deadPath of deadPaths) {
            if (path === deadPath) {
                return weak('marked-as-dead')
            }
            if (path.isDescendant(deadPath)) {
                return weak('dead-by-ancestor')
            }
        }
        return strong('alive')
    }
    const getPathState = (path) => {
        const ownerPath = getGlobalOwner(path)
        if (!ownerPath) {
            throw new Error('no owner path')
        }
        else if (ownerPath === path) {

        }
        else {
            // log('getState delagated to', ownerPath, 'from', path)
        }

        const aliveState = getAliveState(ownerPath)
        if (isWeak(aliveState)) {
            return aliveState
        }
        return visitors[ownerPath.node.type](ownerPath)
    }
    const getPointerState = (pointer, visiteds = []) => {
        if (visiteds.includes(pointer)) {
            return weak('visited')
        }
        visiteds.push(pointer)

        const pathState = getPathState(pointer.path)
        if (isStrong(pathState)) {
            return pathState
        }

        const findStrongReference = (pointer) => {
            for (const reference of pointer.references) {
                const referenceState = getPathState(reference)
                if (isStrong(referenceState)) {
                    return reference
                }
            }
        }
        const strongReference = findStrongReference(pointer)
        if (strongReference) {
            log(
                pointer, 'alive by reference',
                strongReference, 'which is alive because', getPathState(strongReference).reason
            )
            return strong('alive-by-reference')
        }

        const findStrongDependency = (pointer) => {
            const dependencies = pointer.dependencies

            for (const dependency of dependencies) {
                const dependencyState = getPointerState(dependency, visiteds)
                if (isStrong(dependencyState)) {
                    return dependency
                }
                const strongNestedDependency = findStrongDependency(dependency)
                if (strongNestedDependency) {
                    return strongNestedDependency
                }
            }
        }
        const strongDependency = findStrongDependency(pointer)
        if (strongDependency) {
            log(
                pointer, 'alive by dependency to',
                strongDependency, 'which is alive because', getPointerState(strongDependency).reason
            )
            return strong('alive-by-dependency')
        }

        const strongDependent = pointer.dependents.find((dependent) => {
            const dependentState = getPointerState(dependent, visiteds)
            if (isStrong(dependentState)) {
                return true
            }
            return false
        })
        if (strongDependent) {
            log(
                pointer, 'alive by dependent',
                strongDependent, 'which is alive because', getPointerState(strongDependent).reason
            )
            return strong('alive-by-dependent')
        }

        return pathState
    }
    const isKillable = (pointer) => {
        const state = getPointerState(pointer)
        if (isStrong(state)) {
            log(pointer, 'cannot be killed because', state.reason)
            return false
        }
        log(pointer, 'can be killed because', state.reason)
        return true
    }
    const markAsDead = (path) => {
        const ownerPath = getGlobalOwner(path)
        const pathToRemove = ownerPath.isProgram() ? path : ownerPath
        const aliveState = getAliveState(pathToRemove)
        if (isWeak(aliveState)) {
            log(pathToRemove, 'already dead because', aliveState.reason)
            return false
        }
        // supprime les noeuds dead lorsqu'ils sont
        // à l'intérieur d'un path lui même dead
        deadPaths = deadPaths.filter(function(deadPath) {
            var isDescendant = deadPath.isDescendant(pathToRemove)
            if (isDescendant) {
                log(
                    'exclude', deadPath,
                    'because inside', pathToRemove
                )
            }
            return isDescendant === false
        })
        deadPaths.push(pathToRemove)
        log(pathToRemove, 'marked as dead')
        return true
    }

    const pointers = createPointers()
    pointers.forEach((pointer) => {
        if (isKillable(pointer)) {
            markAsDead(pointer.path)
            pointer.references.forEach((reference) => {
                markAsDead(reference)
            })
        }
    })

    return deadPaths
}

module.exports = getExportRemovalDeadPaths
