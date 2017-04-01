// https://astexplorer.net/
// https://github.com/babel/babel/blob/master/packages/babel-plugin-undeclared-variables-check/src/index.js#L19
// https://github.com/GavinJoyce/babel-plugin-remove-functions/blob/master/src/index.js

/*

- tester que les fonctions sont bien supprimées (comme variable et export en gros)

*/

var getExportRemovalDeadPaths = require('./get-export-removal-dead-paths')

const removeReference = (names) => {
    names = names.slice()

    const removeReferencePlugin = () => {
        var removers = {
            VariableDeclaration(path) {
                var parentPath = path.parentPath
                var parentNode = parentPath.node

                path.remove()
                if (parentNode.type === 'ExportDefaultDeclaration') {
                    removePath(parentPath)
                }
                else if (parentNode.type === 'ExportNamedDeclaration') {
                    // seems to be autoremoved when variable declaration is removed
                    // console.log('wanned remove named export', parentPath.node);
                    // removePath(parentPath);
                }
            },
            VariableDeclarator(path) {
                var variableDeclarator = path.node
                var variableDeclarationPath = path.parentPath
                var variableDeclaration = variableDeclarationPath.node
                var declarations = variableDeclaration.declarations
                var filteredDeclarations = declarations.filter(function(declarator) {
                    return declarator !== variableDeclarator
                })
                variableDeclaration.declarations = filteredDeclarations

                if (filteredDeclarations.length === 0) {
                    removePath(variableDeclarationPath)
                }
            },
            ExportDefaultDeclaration(path) {
                // var node = path.node;
                // var declaration = node.declaration;
                // if (declaration) {
                //     console.log('the declaration', declaration);
                // }
                path.remove()
            },
            ExportNamedDeclaration(path) {
                // var node = path.node;
                // var declaration = node.declaration;
                // if (declaration) {
                //     console.log('the declaration', declaration);
                // }
                path.remove()
            },
            ExportSpecifier(path) {
                var exportSpecifier = path.node
                var namedExportPath = path.parentPath
                var namedExport = namedExportPath.node
                var specifiers = namedExport.specifiers
                var filteredSpecifiers = specifiers.filter((specifier) => specifier !== exportSpecifier)
                namedExport.specifiers = filteredSpecifiers

                if (filteredSpecifiers.length === 0) {
                    removePath(namedExportPath)
                }
            },
            FunctionDeclaration(path) {
                path.remove()
            },
            Identifier(path) {
                const parentPath = path.parentPath
                removePath(parentPath)
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

module.exports = removeReference
