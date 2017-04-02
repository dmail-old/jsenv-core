/*

// http://exploringjs.com/es6/ch_modules.html#sec_importing-exporting-details

*/

const createParseRessourcesPlugin = (ressources, normalize = (id) => id) => {
    const createRessource = (id) => {
        return {
            id,
            // type: id === filename ? 'internal' : 'external',
            members: []
        }
    }
    const traceRessource = (importee, importer) => {
        const normalizedId = normalize(importee, importer)
        const existingRessource = ressources.find((ressource) => ressource.id === normalizedId)
        if (existingRessource) {
            return existingRessource
        }
        const ressource = createRessource(normalizedId)
        ressources.push(ressource)
        return ressource
    }

    let filename
    const getMemberState = (path) => {
        const ids = path.scope.getAllBindings()
        const bindings = Object.keys(ids).map((name) => ids[name])
        if (bindings.length === 0) {
            return 'inline'
        }
        const bindingDeclaredOutsiteOfImport = bindings.find((binding) => {
            return (
                binding.path.inType('ImportDeclaration') === false
            )
        })
        if (bindingDeclaredOutsiteOfImport) {
            // console.log(bindingDeclaredOutsiteOfImport.path.node, 'declared outside of import')
            return 'internal'
        }
        const bindingReferencedOutsideOfExport = bindings.find((binding) => {
            const referenceOutsideOfExport = binding.referencePaths.find((referencePath) => {
                return (
                    referencePath.inType(
                        'ExportAllDeclaration',
                        'ExportDefaultDeclaration',
                        'ExportNamedDeclaration'
                    ) === false
                )
            })
            if (referenceOutsideOfExport) {
                // console.log(
                //     'the ref outsite of export', referenceOutsideOfExport.node
                // )
            }
            return Boolean(referenceOutsideOfExport)
        })
        if (bindingReferencedOutsideOfExport) {
            // console.log(bindingReferencedOutsideOfExport.path.node, 'referenced outside of export')
            return 'referenced'
        }
        // console.log(path.node.type, 'bindings are declared by import & only used by export')
        return 'unreferenced'
    }
    const traceImportedMember = (member, from) => {
        const ressource = traceRessource(from, filename)
        ressource.members.push(member)
    }
    const traceExportedMember = (member, path) => {
        const ressource = traceRessource(filename)
        ressource.members.push(Object.assign({}, member, {
            state: typeof path === 'string' ? path : getMemberState(path)
        }))
    }

    const visitors = {
        Program(path, state) {
            filename = state.file.opts.filename
        },
        ImportDeclaration(path, state) {
            const node = path.node
            const source = node.source

            traceRessource(source.value, filename)

            path.traverse({
                ImportSpecifier(path) {
                    const specifier = path.node
                    const imported = specifier.imported
                    const local = specifier.local
                    const member = {
                        name: imported.name
                    }
                    if (local && local.name !== imported.name) {
                        member.as = local.name
                    }
                    traceImportedMember(member, source.value)
                },
                ImportDefaultSpecifier(path) {
                    const specifier = path.node
                    const local = specifier.local
                    const member = {
                        name: 'default'
                    }
                    if (local.name !== member.name) {
                        member.as = local.name
                    }
                    traceImportedMember(member, source.value)
                },
                ImportNamespaceSpecifier(path) {
                    const specifier = path.node
                    traceImportedMember({
                        name: '*',
                        as: specifier.local.name
                    }, source.value)
                }
            }, state)
        },
        ExportNamedDeclaration(path) {
            const declaration = path.get('declaration')
            // https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js#L107
            if (declaration.isDeclaration()) {
                if (declaration.isFunctionDeclaration()) {
                    const identifier = declaration.get('id')
                    traceExportedMember({
                        name: identifier.node.name
                    }, 'inline')
                }
                else if (declaration.isVariableDeclaration()) {
                    const declarations = declaration.get('declarations')
                    for (const variableDeclarator of declarations) {
                        traceExportedMember({
                            name: variableDeclarator.node.id.name
                        }, 'inline')
                    }
                }
            }
            else {
                const node = path.node
                const source = node.source
                const specifiers = path.get('specifiers')
                for (const specifier of specifiers) {
                    const specifierNode = specifier.node
                    const local = specifierNode.local
                    const exported = specifierNode.exported

                    const member = {
                        name: local.name
                    }
                    if (exported && exported.name !== member.name) {
                        member.as = exported.name
                    }
                    if (source) {
                        traceImportedMember(member, source.value)
                        traceExportedMember(member, 'unreferenced')
                    }
                    else {
                        traceExportedMember(member, specifier)
                    }
                }
            }
        },
        ExportAllDeclaration(path) {
            const node = path.node
            const source = node.source

            traceImportedMember({
                name: '*'
            }, source.value)
            traceExportedMember({
                name: '*'
            }, 'unreferenced')
        },
        ExportDefaultDeclaration(path) {
            traceExportedMember({
                name: 'default'
            }, path)
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
