const createTranspiler = require('../../api/util/transpiler.js')

const createCommentImport = require(
    '../babel-plugin-transform-comment-import/create-comment-import.js'
)

const ensureThenable = require('../util/ensure-thenable.js')
const traverseGraphAsync = require('../util/traverse-graph-async.js')

function transform(tree, {
    exclude = () => false
} = {}) {
    const root = tree.root
    exclude = ensureThenable(exclude)

    const excludeStep = () => {
        return traverseGraphAsync(root, (node, dependent) => {
            // only rootNode descendant can be excluded
            if (dependent) {
                const ressource = dependent.ressources.find((ressource) => {
                    return ressource.type !== 'export' && ressource.href === dependent.href
                })
                // only empty import can be excluded
                if (ressource.type === 'import' && ressource.name === undefined) {
                    return exclude(node.id, dependent.id).then((isExcluded) => {
                        if (isExcluded) {
                            ressource.excluded = true
                            return 'continue'
                        }
                    })
                }
            }
        })
    }
    const getTranspiler = (node) => {
        const transpiler = createTranspiler({
            cache: false,
            sourceMaps: true
        })
        const createTransformModule = () => 'babel-plugin-transform-es2015-modules-systemjs'
        transpiler.options.plugins = [
            createCommentImport((importee/* , importer */) => {
                const importeeRessource = node.ressources.find((ressource) => {
                    // because
                    // - we ensure there is no duplicate import
                    // - and we can only exclude empty import
                    // -> we can assume that there is exactly on empty import per file
                    // that's how we find ressource from importee
                    // if any of the above assumptions becomes irrelevant
                    // finding ressource from importee will have to be more robust
                    // (maybe using ressource.start which is the position in the code)
                    return (
                        ressource.type === 'import' &&
                        ressource.name === undefined &&
                        ressource.source === importee
                    )
                })
                if (importeeRessource.excluded) {
                    return true
                }
            }),
            createTransformModule()
        ]
    }
    const transpileStep = () => {
        return traverseGraphAsync(root, (node) => {
            const ast = node.ast
            const transpiler = getTranspiler(node)
            return transpiler.transpileFromAst(ast, node.content, {
                moduleId: node.id,
                filename: node.href
            }).then((result) => {
                node.transpiledContent = result.code
                // node.sourceMap = result.map;
                // node.ast = result.ast;
            })
        })
    }

    return excludeStep().then(transpileStep).then(() => tree)
}

module.exports = transform
