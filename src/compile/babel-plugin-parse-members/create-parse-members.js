/*

j'aurais aussi besoin d'un truc pour vérifier si le member
est utilisé dans le code, car s'il ne l'est pas cela signifique que le module
ne fais que réexporter le membre qui est alors candidat à la suppression

// http://exploringjs.com/es6/ch_modules.html#sec_importing-exporting-details

*/

const createParseModulePlugin = (members) => {
    let filename
    const traceMember = (member) => {
        members.push(member)
    }
    const traceImportedMember = (member, path) => {
        traceMember(Object.assign(
            {},
            {
                type: 'imported',
                path
            },
            member
        ))
    }
    const traceExportedMember = (member) => {
        traceMember(Object.assign(
            {},
            {
                type: 'exported',
                path: filename
            },
            member
        ))
    }
    const getMemberState = (path) => {
        const ids = path.scope.getAllBindings()
        const bindings = Object.keys(ids).map((name) => ids[name])
        if (bindings.length === 0) {
            return 'inline-declaration'
        }
        const everyBindingIsDeclaredByImport = bindings.every((binding) => {
            return binding.path.isImportDeclaration()
        })
        if (!everyBindingIsDeclaredByImport) {
            return 'internal-declaration'
        }
        const everyBindingAreReferencedOnlyByExport = bindings.every((binding) => {
            return binding.referencePaths.every((referencePath) => {
                return referencePath.isExportDeclaration()
            })
        })
        if (!everyBindingAreReferencedOnlyByExport) {
            console.log(path.node.type, 'has bindings referenced somewhere')
            return 'imported-declaration-referenced'
        }
        console.log(path.node.type, 'bindings are declared by import & only used by export')
        return 'imported-declaration-unreferenced'
    }

    const visitors = {
        Program(path, state) {
            filename = state.file.opts.filename
        },
        ImportDeclaration(path, state) {
            const node = path.node
            const source = node.source

            path.traverse({
                ImportSpecifier(path) {
                    const specifier = path.node
                    traceImportedMember({
                        name: specifier.local.name,
                        as: specifier.imported ? specifier.imported.name : null
                    }, source.value)
                },
                ImportDefaultSpecifier(path) {
                    const specifier = path.node
                    traceImportedMember({
                        name: 'default',
                        as: specifier.local.name
                    }, source.value)
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
            const node = path.node
            const source = node.source

            // faudrais handle declaration aussi
            const specifiers = node.specifiers
            specifiers.forEach((specifier) => {
                const member = {
                    name: specifier.local.name,
                    as: specifier.exported ? specifier.exported.name : null
                }
                if (source) {
                    traceImportedMember(member, source.value)
                }
                traceExportedMember(member)
            })
        },
        ExportAllDeclaration(path) {
            const node = path.node
            const source = node.source

            traceImportedMember({
                name: '*'
            }, source.value)
            traceExportedMember({
                name: '*',
                state: getMemberState(path)
            })
        },
        ExportDefaultDeclaration(path) {
            traceExportedMember({
                name: 'default',
                state: getMemberState(path)
            })
        }
    }

    const parseModulePlugin = () => {
        return {
            visitor: visitors
        }
    }
    return parseModulePlugin
}

module.exports = createParseModulePlugin
