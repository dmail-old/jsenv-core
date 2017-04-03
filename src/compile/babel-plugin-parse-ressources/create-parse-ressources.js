/*

// http://exploringjs.com/es6/ch_modules.html#sec_importing-exporting-details

https://github.com/rollup/rollup/blob/master/src/Module.js#L413
https://github.com/rollup/rollup/blob/master/src/Module.js#L232

*/

const getProgramRessources = (program, normalize, filename) => {
    const createRessource = (name, localName, source, start) => {
        const ressource = {}
        ressource.source = source
        ressource.start = start
        ressource.name = name
        if (localName && name !== localName) {
            ressource.localName = localName
        }
        return ressource
    }
    const createImportedRessource = (name, localName, source, start) => {
        const ressource = createRessource(name, localName, normalize(source, filename), start)
        ressource.type = 'import'
        return ressource
    }
    const createExportedRessource = (name, localName, source, start) => {
        const ressource = createRessource(name, localName, filename, start)
        ressource.type = 'export'
        return ressource
    }
    const createReExportedRessource = (name, localName, source, start) => {
        const ressource = createRessource(name, localName, normalize(source, filename), start)
        ressource.type = 'reexport'
        return ressource
    }
    const getImportSpecifierName = (specifier) => {
        if (specifier.type === 'ImportDefaultSpecifier') {
            return 'default'
        }
        if (specifier.type === 'ImportNamespaceSpecifier') {
            return '*'
        }
        return specifier.imported.name
    }
    const generators = {
        // import foo from '...'
        // import { name } from '...'
        // import { a, b } from '...'
        // import { c as d } from '...'
        // import e, * as f from '...'
        // import g, { h } from '...'
        // import '...'
        importedSpecifiers(node) {
            const source = node.source.value
            return node.specifiers.map((specifier) => {
                const localName = specifier.local.name
                const name = getImportSpecifierName(specifier)
                return createImportedRessource(name, localName, source, specifier.start)
            })
        },
        // export * from '...'
        reexportedNamespace(node) {
            const ressource = createReExportedRessource('*', null, node.source.value, node.start)
            return [ressource]
        },
        // export { name } from '...'
        rexportedSpecifiers(node) {
            const source = node.source.value
            return node.specifiers.map((specifier) => {
                return createReExportedRessource(
                    specifier.exported.name,
                    specifier.local.name,
                    source,
                    specifier.start
                )
            })
        },
        // export var { foo, bar } = ...
        // export var a, b = ...
        exxportedVariableDeclaration(node) {
            return node.declarations.map((variableDeclarator) => {
                return createExportedRessource(variableDeclarator.id.name, null, null, node.start)
            })
        },
        // export function foo () {}
        // export class bar {}
        exportedDeclaration(node) {
            const localName = node.id.name
            const exportedRessource = createExportedRessource(localName, null, null, node.start)
            return [exportedRessource]
        },
        // export { foo, bar, baz }
        exportedSpecifiers(node) {
            return node.specifiers.map((specifier) => {
                const localName = specifier.local.name
                const exportedName = specifier.exported.name
                return createExportedRessource(exportedName, localName, null, specifier.start)
            })
        },
        // export default function foo () {}
        // export default foo;
        // export default 42;
        exportedDefault(node) {
            const localName = node.declaration.id ? node.declaration.id.name : node.declaration.name
            const ressource = createExportedRessource('default', localName, null, node.start)
            return [ressource]
        }
    }
    const visitors = {
        ImportDeclaration(node) {
            return generators.importedSpecifiers(node)
        },
        ExportAllDeclaration(node) {
            return generators.reexportedNamespace(node)
        },
        ExportNamedDeclaration(node) {
            if (node.source) {
                return generators.rexportedSpecifiers(node)
            }
            if (node.declaration) {
                const declaration = node.declaration
                if (declaration.type === 'VariableDeclaration') {
                    return generators.exxportedVariableDeclaration(declaration)
                }
                return generators.exportedDeclaration(declaration)
            }
            return generators.exportedSpecifiers(node)
        },
        ExportDefaultDeclaration(node) {
            return generators.exportedDefault(node)
        }
    }

    const ressources = []
    for (const node of program.body) {
        const {type} = node
        if (type in visitors) {
            const partialRessources = visitors[type](node)
            ressources.push(...partialRessources)
        }
    }
    return ressources
}

/*
helpers to throw errors when code do weird things
*/
// const getDuplicateRessources = (ressources) => {
//     return ressources.filter((ressource, index) => {
//         return ressources.findIndex((otherRessource) => {
//             return otherRessource.name === ressource.name
//         }, index) > -1
//     })
// }
// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L125
// const getDuplicateExports = (ressources) => {
//     const exportedRessources = ressources.filter((ressource) => ressource.type !== 'import')
//     return getDuplicateRessources(exportedRessources)
// }
// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L219
// const getDuplicateImports = (ressources) => {
//     const importedRessources = ressources.filter((ressource) => ressource.type === 'import')
//     return getDuplicateRessources(importedRessources)
// }
// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Bundle.js#L400
// const getSelfImport = (ressources) => {
//     return ressources.find((ressource) => {
//         return ressource.type === 'import' && ressource.source === filename
//     })
// }

function createParseRessourcesPlugin(ressources, normalize = (id) => id) {
    const visitors = {
        Program(path, state) {
            const filename = state.file.opts.filename
            const programRessources = getProgramRessources(path.node, normalize, filename)
            ressources.push(...programRessources)
        }
    }

    const parseRessourcesPlugin = () => {
        return {
            visitor: visitors
        }
    }
    return parseRessourcesPlugin
}

module.exports = createParseRessourcesPlugin
