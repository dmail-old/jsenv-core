/*

il faudra pouvoir en gros savoir quels member sont importé par qui et savoir si certain
member sont inutilisé et candidat à être supprimé

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
// const root = require('path').resolve(process.cwd(), '../../../').replace(/\\/g, '/')
// const rootHref = 'file:///' + root

function getNodeFilename(filename) {
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
function readSource(filename) {
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
function normalize(path) {
    return path.replace(/\\/g, '/')
}

function parse(entryRelativeHref, {
    variables = {},
    baseHref,
    fetch = function(node, readSource) {
        return readSource(node.href)
    }
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
            members: []
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
                createParseRessources(ressources, locateId)
            ]
        })
        return ressources
    }
    const fetchAndParseRessources = (node) => {
        // console.log('fetching', node.id);
        return Promise.resolve(fetch(node, readSource)).then((code) => {
            node.code = code
            return parseRessource(node)
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
                ressources.forEach((ressource) => {
                    if (ressource.id === node.id) {
                        console.log(node.id, 'is exporting', ressource.members)
                        node.members.push(...ressource.members)
                    }
                    else {
                        const dependency = getNode(baseHref + ressource.id)
                        if (node.dependencies.includes(dependency) === false) {
                            node.dependencies.push(dependency)
                        }
                        if (dependency.dependents.includes(node) === false) {
                            dependency.dependents.push(node)
                        }

                        console.log(node.id, 'is importing', ressource.members)
                        node.members.push(...ressource.members)
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
            return {
                locate: locate,
                fetch: (node) => fetch(node, readSource),
                root: entryNode
            }
        })
    })
}

module.exports = parse

