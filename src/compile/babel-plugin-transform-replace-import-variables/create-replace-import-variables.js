const createReplaceImportVariablesPlugin = (variables) => {
    const replaceVariables = (value) => {
        return String(value).replace(/\$\{([^{}]+)\}/g, (match, name) => {
            return name in variables ? variables[name] : match
        })
    }

    const replaceImportVariablesPlugin = () => {
        const visitImportDeclaration = (path) => {
            const from = path.node.source.value
            path.node.source.value = replaceVariables(from)
        }

        return {
            visitor: {
                ImportDeclaration: visitImportDeclaration
            }
        }
    }
    return replaceImportVariablesPlugin
}

module.exports = createReplaceImportVariablesPlugin
