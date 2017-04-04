/*

// http://exploringjs.com/es6/ch_modules.html#sec_importing-exporting-details

https://github.com/rollup/rollup/blob/master/src/Module.js#L413
https://github.com/rollup/rollup/blob/master/src/Module.js#L232

*/

const getProgramRessources = (program, filename) => {
    const createRessource = (type, source, start, name, localName) => {
        const ressource = {
            type,
            source,
            start
        }
        if (name) {
            ressource.name = name
            if (localName && name !== localName) {
                ressource.localName = localName
            }
        }
        return ressource
    }
    const createImportedRessource = (source, start, name, localName) => {
        return createRessource('import', source, start, name, localName)
    }
    const createExportedRessource = (start, name, localName) => {
        return createRessource('export', filename, start, name, localName)
    }
    const createReExportedRessource = (source, start, name, localName) => {
        return createRessource('reexport', source, start, name, localName)
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
        // import '...'
        emptyImport(node) {
            const ressource = createImportedRessource(node.source.value, node.start)
            return [ressource]
        },
        // import foo from '...'
        // import { name } from '...'
        // import { a, b } from '...'
        // import { c as d } from '...'
        // import e, * as f from '...'
        // import g, { h } from '...'
        importedSpecifiers(node) {
            const source = node.source.value
            return node.specifiers.map((specifier) => {
                const localName = specifier.local.name
                const name = getImportSpecifierName(specifier)
                return createImportedRessource(source, specifier.start, name, localName)
            })
        },
        // export * from '...'
        reexportedNamespace(node) {
            const ressource = createReExportedRessource(node.source.value, node.start, '*')
            return [ressource]
        },
        // export { name } from '...'
        rexportedSpecifiers(node) {
            const source = node.source.value
            return node.specifiers.map((specifier) => {
                return createReExportedRessource(
                    source,
                    specifier.start,
                    specifier.exported.name,
                    specifier.local.name
                )
            })
        },
        // export var { foo, bar } = ...
        // export var a, b = ...
        exportedVariableDeclaration(node) {
            return node.declarations.map((variableDeclarator) => {
                return createExportedRessource(node.start, variableDeclarator.id.name)
            })
        },
        // export function foo () {}
        // export class bar {}
        exportedDeclaration(node) {
            const localName = node.id.name
            const exportedRessource = createExportedRessource(node.start, localName)
            return [exportedRessource]
        },
        // export { foo, bar, baz }
        exportedSpecifiers(node) {
            return node.specifiers.map((specifier) => {
                const localName = specifier.local.name
                const exportedName = specifier.exported.name
                return createExportedRessource(specifier.start, exportedName, localName)
            })
        },
        // export default function foo () {}
        // export default foo;
        // export default 42;
        exportedDefault(node) {
            const localName = node.declaration.id ? node.declaration.id.name : node.declaration.name
            const ressource = createExportedRessource(node.start, 'default', localName)
            return [ressource]
        }
    }
    const visitors = {
        ImportDeclaration(node) {
            const specifiers = node.specifiers
            if (specifiers.length === 0) {
                return generators.emptyImport(node)
            }
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

function createParseRessourcesPlugin(ressources) {
    const visitors = {
        Program(path, state) {
            const filename = state.file.opts.filename
            const programRessources = getProgramRessources(path.node, filename)
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
