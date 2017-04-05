/*

*/

const babel = require('babel-core')
const fs = require('fs')

const mapAsync = require('../../api/util/map-async.js')
const resolveIfNotPlain = require('./resolve-if-not-plain.js')
const createReplaceImportVariables = require(
    '../babel-plugin-transform-replace-import-variables/create-replace-import-variables.js'
)
const createParseRessources = require(
    '../babel-plugin-parse-ressources/create-parse-ressources.js'
)
const ressourceUtil = require('../babel-plugin-parse-ressources/util.js')
const util = require('./util.js')
// const root = require('path').resolve(process.cwd(), '../../../').replace(/\\/g, '/')
// const rootHref = 'file:///' + root
const ensureThenable = require('../util/ensure-thenable.js')

const getNodeFilename = (filename) => {
    filename = String(filename)

    var nodeFilename
    if (filename.indexOf('file:///') === 0) {
        nodeFilename = filename.slice('file:///'.length)
    }
    else {
        nodeFilename = filename
    }
    return nodeFilename
}
const readSource = (filename) => {
    filename = getNodeFilename(filename)
    // console.log('reading', filename)
    return new Promise((resolve, reject) => {
        return fs.readFile(filename, (error, buffer) => {
            if (error) {
                reject(error)
            }
            else {
                resolve(buffer.toString())
            }
        })
    })
}
const normalize = (path) => path.replace(/\\/g, '/')

const possibleErrors = [
    {
        code: 'UNRESOLVED_IMPORT',
        message: ({ressource, node}) => (
            `Could not resolve '${ressource.source}' from ${node.id}`
        )
    },
    {
        code: 'UNRESOLVED_REEXPORT',
        message: ({ressource, node}) => (
            `Could not resolve '${ressource.source}' from ${node.id}`
        )
    },
    {
        code: 'FETCH_ERROR',
        message: ({ressource, node}) => (
            `Error while fetching '${ressource.source}' from ${node.id}`
        )
    },
    {
        code: 'DUPLICATE_EXPORT_DEFAULT',
        message: () => (
            `A module can only have one default export`
        )
    },
    {
        code: 'DUPLICATE_EXPORT',
        message: ({ressource}) => (
            `A module cannot have multiple exports with the same name ('${ressource.name}')`
        )
    },
    // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L219
    {
        code: 'DUPLICATE_IMPORT',
        message: ({ressource}) => (
            `Duplicated import of ('${ressource.localName}')`
        )
    },
    {
        code: 'DUPLICATE_REEXPORT',
        message: ({ressource}) => (
            `Duplicated reexport of ('${ressource.localName}')`
        )
    },
    // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Bundle.js#L400
    {
        code: 'SELF_IMPORT',
        message: () => (
            `A module cannot import from itself`
        )
    },
    {
        code: 'SELF_REEXPORT',
        message: () => (
            `A module cannot export from itself`
        )
    },
    {
        code: 'MISSING_EXPORT',
        message: ({ressource}) => (
            `${ressource.name} is not exported by ${ressource.source}`
        )
    }
]
const createContextualizedError = util.createErrorGenerator(possibleErrors)

function parse(entryRelativeHref, {
    variables = {},
    baseHref,
    fetch = (node, readSource) => readSource(node.href),
    resolve
} = {}) {
    baseHref = baseHref || 'file:///' + normalize(process.cwd())
    // ensure trailing / so that we are absolutely sure it's a folder
    if (baseHref[baseHref.length - 1] !== '/') {
        baseHref += '/'
    }
    // baseHref = baseHref.slice(0, baseHref.lastIndexOf('/'))
    resolve = resolve || function(importee, importer) {
        const resolved = resolveIfNotPlain(importee, importer)
        if (resolved) {
            return resolved
        }
        return baseHref + importee
    }
    resolve = ensureThenable(resolve)
    fetch = ensureThenable(fetch)
    const locate = (...args) => resolve(...args).then(normalize)
    const hrefToId = (href) => href.slice(baseHref.length)

    const nodes = []
    const createNode = (href) => {
        const node = {
            id: hrefToId(href),
            href,
            dependencies: [],
            dependents: [],
            ressources: []
        }
        return node
    }
    const findNodeByHref = (href) => {
        return nodes.find((node) => node.href === href)
    }
    const getNode = (href, ressource) => {
        const existingNode = findNodeByHref(href)
        if (existingNode) {
            return existingNode
        }
        const node = createNode(href)
        if (ressource) {
            node.createdByRessource = ressource
        }
        nodes.push(node)
        return node
    }
    const parseRessource = (node) => {
        const ressources = []
        // console.log('transforming', node.href)
        babel.transform(node.code, {
            ast: true,
            code: false,
            sourceMaps: false,
            babelrc: false,
            filename: node.href,
            plugins: [
                createReplaceImportVariables(variables),
                createParseRessources(ressources)
            ]
        })

        const externalRessources = ressourceUtil.getExternals(ressources)
        return mapAsync(externalRessources, (ressource) => {
            return locate(ressource.source, node.href).then(
                (href) => {
                    ressource.href = href
                    ressource.id = hrefToId(href)
                },
                () => {
                    if (ressource.type === 'import') {
                        throw createContextualizedError(
                            'UNRESOLVED_IMPORT',
                            {node, ressource}
                        )
                    }
                    if (ressource.type === 'reexport') {
                        throw createContextualizedError(
                            'UNRESOLVED_REEXPORT',
                            {node, ressource}
                        )
                    }
                }
            )
        }).then(() => {
            const [internals, externals] = ressourceUtil.bisect(ressources)

            const internalDuplicate = internals.find((ressource, index, array) => {
                return array.slice(index + 1).some((nextRessource) => (
                    ressource.name && ressource.name === nextRessource.name
                ))
            })
            // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L125
            if (internalDuplicate) {
                if (internalDuplicate.name === 'default') {
                    throw createContextualizedError(
                        'DUPLICATE_EXPORT_DEFAULT',
                        {node, ressource: internalDuplicate}
                    )
                }
                throw createContextualizedError(
                    'DUPLICATE_EXPORT',
                    {node, ressource: internalDuplicate}
                )
            }
            // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L219
            const externalDuplicate = externals.find((ressource, index, array) => {
                return array.slice(index + 1).some((nextRessource) => (
                    ressource.localName === nextRessource.localName
                ))
            })
            if (externalDuplicate) {
                if (externalDuplicate.type === 'import') {
                    throw createContextualizedError(
                        'DUPLICATE_IMPORT',
                        {node, ressource: externalDuplicate}
                    )
                }
                if (externalDuplicate.type === 'reexport') {
                    throw createContextualizedError(
                        'DUPLICATE_REEXPORT',
                        {node, ressource: externalDuplicate}
                    )
                }
            }
            // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Bundle.js#L400
            const externalSelf = externals.find((ressource) => (
                ressource.href === node.href
            ))
            if (externalSelf) {
                if (externalSelf.type === 'import') {
                    throw createContextualizedError(
                        'SELF_IMPORT',
                        {node, ressource: externalSelf}
                    )
                }
                if (externalSelf.type === 'reexport') {
                    throw createContextualizedError(
                        'SELF_REEXPORT',
                        {node, ressource: externalSelf}
                    )
                }
            }

            return ressources
        })
    }
    const fetchAndParseRessources = (node) => {
        // console.log('fetching', node.id);
        return fetch(node, readSource).then(
            (code) => {
                node.code = code
                return parseRessource(node)
            },
            (e) => {
                if (node.createdByRessource) {
                    const ressource = node.createdByRessource
                    throw createContextualizedError(
                        'FETCH_ERROR',
                        {
                            node: node.dependents.find((dependent) => {
                                return dependent.href === ressource.href
                            }),
                            importee: node,
                            ressource,
                            error: e
                        }
                    )
                }
                const error = new Error(`error fetching entry ${node.href}`)
                error.code = 'FETCH_ENTRY_ERROR'
                throw error
            }
        ).then((ressources) => {
            node.ressources = ressources
            return ressources
        })
    }

    const parseCache = {}
    const parseNode = (node) => {
        let promise
        if (node.id in parseCache) {
            promise = parseCache[node.id]
        }
        else {
            promise = Promise.resolve(
                fetchAndParseRessources(node)
            ).then((ressources) => {
                const externalRessources = ressourceUtil.getExternals(ressources)
                const dependencies = []
                externalRessources.forEach((ressource) => {
                    const dependency = getNode(ressource.href, ressource)
                    if (dependencies.includes(dependency) === false) {
                        // console.log(node.id, 'depends on', dependency.id)
                        dependencies.push(dependency)
                    }
                    if (dependency.dependents.includes(node) === false) {
                        dependency.dependents.push(node)
                    }
                })
                node.dependencies = dependencies

                return mapAsync(dependencies, parseNode)
            })
            parseCache[node.id] = promise
        }

        return promise
    }

    return locate(entryRelativeHref, baseHref).then(
        (entryHref) => {
            const entryNode = getNode(entryHref)
            return parseNode(entryNode).then(() => {
                // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L426}
                const missingExport = util.getMissingExport(entryNode)
                if (missingExport) {
                    throw createContextualizedError('MISSING_EXPORT', missingExport)
                }

                return {
                    locate,
                    fetch,
                    root: entryNode
                }
            })
        },
        () => {
            // https://github.com/rollup/rollup/blob/master/src/Bundle.js#L111
            const error = new Error(`cannot resolve entry ${entryRelativeHref}`)
            error.code = 'UNRESOLVED_ENTRY'
            throw error
        }
    )
}

module.exports = parse

