// https://astexplorer.net/
// https://github.com/babel/babel/blob/master/packages/babel-plugin-undeclared-variables-check/src/index.js#L19
// https://github.com/GavinJoyce/babel-plugin-remove-functions/blob/master/src/index.js

/*

- tester que les fonctions sont bien supprimées (comme variable et export en gros)

*/

var getExportRemovalDeadPaths = require('./get-export-removal-dead-paths.js')

const createRemoveExportPlugin = (names) => {
    names = names.slice()

    const removeReferencePlugin = () => {
        const removers = {
            ExportDefaultDeclaration(path) {
                path.remove()
            },
            ExportNamedDeclaration(path) {
                path.remove()
            },
            ExportSpecifier(path) {
                const exportSpecifier = path.node
                const namedExportPath = path.parentPath
                const namedExport = namedExportPath.node
                const specifiers = namedExport.specifiers
                const filteredSpecifiers = specifiers.filter((specifier) => specifier !== exportSpecifier)
                namedExport.specifiers = filteredSpecifiers

                if (filteredSpecifiers.length === 0) {
                    removePath(namedExportPath)
                }
            },
            VariableDeclaration(path) {
                const parentPath = path.parentPath

                path.remove()
                if (parentPath.isExportDefaultDeclaration()) {
                    removePath(parentPath)
                }
                else if (parentPath.isExportNamedDeclaration()) {
                    // seems to be autoremoved when variable declaration is removed
                }
            },
            VariableDeclarator(path) {
                const variableDeclarator = path.node
                const variableDeclarationPath = path.parentPath
                const variableDeclaration = variableDeclarationPath.node
                const declarations = variableDeclaration.declarations
                const filteredDeclarations = declarations.filter(function(declarator) {
                    return declarator !== variableDeclarator
                })
                variableDeclaration.declarations = filteredDeclarations

                if (filteredDeclarations.length === 0) {
                    removePath(variableDeclarationPath)
                }
            },
            FunctionDeclaration(path) {
                path.remove()
            }
        }
        const removePath = (path) => {
            var node = path.node
            var type = node.type
            if (type in removers) {
                console.log('removing', type)
                removers[type](path)
            }
            else {
                throw new Error('cannot remove ' + type)
            }
        }
        const visitProgram = (path, state) => {
            const deadPaths = getExportRemovalDeadPaths(path, state, names)
            console.log('will remove', deadPaths.map((path) => path.node.type))
            deadPaths.forEach(removePath)
        }

        return {
            visitor: {
                Program: visitProgram
            }
        }
    }
    return removeReferencePlugin
}

module.exports = createRemoveExportPlugin
