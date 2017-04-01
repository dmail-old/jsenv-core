const createCommentImportPlugin = (fn) => {
    const commentImport = (path) => {
        const from = path.node.source.value
        const commentString = ` import '${from}'`
        path.remove()
        // add a comment here to show that there was an import here
        // that was auto removed because not required
        const prev = path.getSibling(path.key - 1)
        const next = path.getSibling(path.key + 1)
        if (prev && prev.node) {
            prev.addComment('trailing', commentString, true)
        }
        else if (next && next.node) {
            next.addComment('leading', commentString, true)
        }
    }

    const removeImportPlugin = () => {
        const visitImportDeclaration = (path, state) => {
            if (fn(path.node.source.value, state.file.opts.filename)) {
                commentImport(path)
            }
        }

        return {
            visitor: {
                ImportDeclaration: visitImportDeclaration
            }
        }
    }

    return removeImportPlugin
}

module.exports = createCommentImportPlugin
