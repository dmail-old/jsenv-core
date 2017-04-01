const mapAsync = require('../../api/util/map-async.js')
const createTranspiler = require('../../api/util/transpiler.js')

const createCommentImport = require(
    '../babel-plugin-transform-comment-import/create-comment-import.js'
)

const removeWhen = require('./remove-when.js')
const collectDependencies = require('./collect-dependencies.js')
const addImporteds = require('./add-importeds.js')

function transform(tree, {
    exclude = () => false
} = {}) {
    const root = tree.root
    addImporteds(root)

    const getTranspiler = (node, removedNodes) => {
        const transpiler = createTranspiler({
            cache: false,
            sourceMaps: true
        })
        const pathIsRemoved = (path) => {
            removedNodes = [...removedNodes, ...collectDependencies(...removedNodes)]
            return removedNodes.some((removedNode) => removedNode.path === path)
        }
        const createTransformModule = () => 'babel-plugin-transform-es2015-modules-systemjs'
        transpiler.options.plugins = [
            createCommentImport((importee, importer) => {
                var importPath = tree.locate(importee, importer)
                var importIsRemoved = pathIsRemoved(importPath)
                if (importIsRemoved) {
                    console.log(importee, 'import removed from', importer)
                }
                return importIsRemoved
            }),
            createTransformModule()
        ]
    }

    return removeWhen(root, exclude).then((removedNodes) => {
        const nodes = [root, ...collectDependencies(root)]
        return mapAsync(nodes, (node) => {
            return tree.fetch(node).then((source) => {
                const transpiler = getTranspiler(node, removedNodes)
                // node.originalSource = source;
                return transpiler.transpile(source, {
                    moduleId: node.id,
                    filename: node.path
                })
            }).then((result) => {
                node.source = result.code
                // node.sourceMap = result.map;
                // node.ast = result.ast;
            })
        }).then(() => {
            return nodes
        })
    })
}

module.exports = transform
