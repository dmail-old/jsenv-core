const babel = require('babel-core')
const fs = require('fs')

const mapAsync = require('../../api/util/map-async.js')
const resolveIfNotPlain = require('./resolve-if-not-plain.js')
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
        return readSource(node.path)
    }
} = {}) {
    baseHref = baseHref || 'file:///' + normalize(process.cwd()) + '/'

    // ensure trailing / so that we are absolutely sure it's a folder
    if (baseHref[baseHref.length - 1] !== '/') {
        baseHref += '/'
    }
    // baseHref = baseHref.slice(0, baseHref.lastIndexOf('/'))

    function resolve(importee, importer) {
        const resolved = resolveIfNotPlain(importee, importer)
        if (resolved) {
            return resolved
        }
        return baseHref + '/' + importee
    }
    function locate() {
        const absoluteHref = resolve.apply(this, arguments)
        // console.log(
        //     'locate',
        //     arguments[0],
        //     '->',
        //     absoluteHref,
        //     'from',
        //     arguments[1]
        // );
        return normalize(absoluteHref)
    }

    const nodes = []
    function findById(id) {
        return nodes.find((node) => node.id === id)
    }
    function createNode(href) {
        var id = href.slice(baseHref.length)

        var existingNode = findById(id)
        if (existingNode) {
            return existingNode
        }
        var node = {
            id: id,
            path: href,
            importations: [],
            dependencies: [],
            dependents: []
        }
        nodes.push(node)
        return node
    }
    function getDependenciesFromAst(node, ast) {
        var astNodes = ast.program.body

        return astNodes.map(
            (astNode) => visit(astNode)
        ).filter(
            (result) => Boolean(result)
        )
    }
    function transform(code) {
        const trace = {}
        babel.transform(code, {
            ast: true,
            code: false,
            sourceMaps: false,
            babelrc: false,
            plugins: [
                createParseModule(trace)
            ]
        })
        return trace
    }
    function fetchAndTransform(node) {
        // console.log('fetching', node.id);
        return Promise.resolve(fetch(node, readSource)).then(transform)
    }

    const parseCache = {}
    function parseNode(node) {
        let promise
        if (node.id in parseCache) {
            promise = parseCache[node.id]
        }
        else {
            promise = Promise.resolve(
                fetchAndTransform(node)
            ).then((result) => {
                var astDependencies = getDependenciesFromAst(node, result.ast).map((astDependency) => {
                    astDependency.path = astDependency.path.replace(/\$\{([^{}]+)\}/g, function(match, name) {
                        if (name in variables) {
                            return variables[name]
                        }
                        return match
                    })
                    return astDependency
                })
                const dependencies = astDependencies.map((astDependency) => {
                    var dependencyHref = locate(astDependency.path, node.path)
                    var dependencyNode = createNode(dependencyHref)
                    return dependencyNode
                })
                dependencies.forEach((dependency, index) => {
                    var dependencyIndex = node.dependencies.indexOf(dependency)
                    if (dependencyIndex === -1) {
                        node.dependencies.push(dependency)
                        node.importations.push([])
                    }

                    if (dependency.dependents.indexOf(node) === -1) {
                        dependency.dependents.push(node)
                    }

                    var astDependency = astDependencies[index]
                    var importations = node.importations[index]
                    var members = astDependency.members
                    members.forEach((member) => {
                        var memberName = member.name
                        if (memberName) {
                            if (importations.indexOf(memberName) === -1) {
                                importations.push(memberName)
                            }
                        }
                    })
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
        const entryNode = createNode(entryHref)
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

