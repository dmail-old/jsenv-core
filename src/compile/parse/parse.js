/*

à faire :

- l'erreur devrait append le code frame pour contextualiser le message
https://github.com/rollup/rollup/blob/master/src/Module.js#L295
https://github.com/rollup/rollup/blob/master/src/utils/error.js#L5
apparement il suffit de copier les bonne props sur l'objet error pour obtenir une erreur cool

- lorsqu'un import n'est pas trouvé faudrais aussi avoir la frame pour savoir quel import
déclenche l'import du module et fail lorsqu'on essaye de le trouver (404 sur fetch ou normalize qui fail)

- dans utils/getCodeFrame supporter sourcemap si le fichier en contient
(en gros cela signifie remonter sourcemap pour trouver le vrai codeframe)

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

const createMissingExportError = ({
    node,
    ressource
}) => ({
    code: 'MISSING_EXPORT',
    message: `${ressource.name} is not exported by ${ressource.source}`,
    frame: util.getNodeFrame(node, ressource.start)
})
const createDuplicateExportDefaultError = ({
    node,
    ressource
}) => ({
    code: 'DUPLICATE_EXPORT_DEFAULT',
    message: `A module can only have one default export`,
    frame: util.getNodeFrame(node, ressource.start)
})
const createDuplicateExportError = ({
    node,
    ressource
}) => ({
    code: 'DUPLICATE_EXPORT',
    message: `A module cannot have multiple exports with the same name ('${ressource.name}')`,
    frame: util.getNodeFrame(node, ressource.start)
})
// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L219
const createDuplicateImportErrror = ({
    node,
    ressource
}) => ({
    code: 'DUPLICATE_IMPORT',
    message: `Duplicated import of ('${ressource.localName}')`,
    frame: util.getNodeFrame(node, ressource.start)
})
const createDuplicateReexportError = ({
    node,
    ressource
}) => ({
    code: 'DUPLICATE_REEXPORT',
    message: `Duplicated reexport of ('${ressource.localName}')`,
    frame: util.getNodeFrame(node, ressource.start)
})
// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Bundle.js#L400
const createSelfImportError = ({
    node,
    ressource
}) => ({
    code: 'SELF_IMPORT',
    message: `A module cannot import from itself`,
    frame: util.getNodeFrame(node, ressource.start)
})
const createSelfReexportError = ({
    node,
    ressource
}) => ({
    code: 'SELF_REEXPORT',
    message: `A module cannot export from itself`,
    frame: util.getNodeFrame(node, ressource.start)
})

function parse(entryRelativeHref, {
    variables = {},
    baseHref,
    fetch = (node, readSource) => readSource(node.href)
} = {}) {
    baseHref = baseHref || 'file:///' + normalize(process.cwd())

    // ensure trailing / so that we are absolutely sure it's a folder
    if (baseHref[baseHref.length - 1] !== '/') {
        baseHref += '/'
    }
    // baseHref = baseHref.slice(0, baseHref.lastIndexOf('/'))

    const resolve = (importee, importer) => {
        const resolved = resolveIfNotPlain(importee, importer)
        if (resolved) {
            return resolved
        }
        return baseHref + importee
    }
    const locate = (...args) => normalize(resolve(...args))

    const hrefToId = (href) => href.slice(baseHref.length)
    const locateId = (importee, importer) => {
        return hrefToId(locate(importee, importer))
    }

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
    const getNode = (href) => {
        const existingNode = findNodeByHref(href)
        if (existingNode) {
            return existingNode
        }
        const node = createNode(href)
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

        const normalizedRessources = ressourceUtil.normalize(ressources, node.href, locateId)
        const internalDuplicate = ressourceUtil.findInternalDuplicate(normalizedRessources)
        // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L125
        if (internalDuplicate) {
            if (internalDuplicate.name === 'default') {
                throw createDuplicateExportDefaultError({node, ressource: internalDuplicate})
            }
            throw createDuplicateExportError({node, ressource: internalDuplicate})
        }
        // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L219
        const externalDuplicate = ressourceUtil.findExternalDuplicate(normalizedRessources)
        if (externalDuplicate) {
            if (externalDuplicate.type === 'import') {
                throw createDuplicateImportErrror({node, ressource: externalDuplicate})
            }
            if (externalDuplicate.type === 'reexport') {
                throw createDuplicateReexportError({node, ressource: externalDuplicate})
            }
        }
        // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Bundle.js#L400
        const externalSelf = ressourceUtil.findExternalBySource(normalizedRessources, node.href)
        if (externalSelf) {
            if (externalSelf.type === 'import') {
                throw createSelfImportError({node, ressource: externalSelf})
            }
            if (externalSelf.type === 'reexport') {
                throw createSelfReexportError({node, ressource: externalSelf})
            }
        }

        return normalizedRessources
    }
    const fetchAndParseRessources = (node) => {
        // console.log('fetching', node.id);
        return Promise.resolve(fetch(node, readSource)).then((code) => {
            node.code = code
            return parseRessource(node)
        }).then((ressources) => {
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

                externalRessources.forEach((ressource) => {
                    const dependency = getNode(ressource.source)
                    if (node.dependencies.includes(dependency) === false) {
                        console.log(node.id, 'depends on', ressource.source)
                        node.dependencies.push(dependency)
                    }
                    if (dependency.dependents.includes(node) === false) {
                        dependency.dependents.push(node)
                    }
                })

                return mapAsync(node.dependencies, parseNode).then(() => {
                    return node
                })
            })
            parseCache[node.id] = promise
        }

        return promise
    }

    return Promise.resolve(locate(entryRelativeHref, baseHref)).then((entryHref) => {
        const entryNode = getNode(entryHref)
        return parseNode(entryNode).then(() => {
            // https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L426}
            const missingExport = util.getMissingExport(entryNode)
            if (missingExport) {
                throw createMissingExportError(missingExport)
            }

            return {
                locate: locate,
                fetch: (node) => fetch(node, readSource),
                root: entryNode
            }
        })
    })
}

module.exports = parse

