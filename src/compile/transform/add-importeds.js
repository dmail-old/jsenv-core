const addImporteds = (rootNode) => {
    const visit = (node) => {
        const importeds = []
        node.dependents.forEach((dependent) => {
            const index = dependent.dependencies.indexOf(node)
            const importation = dependent.importations[index]
            importation.forEach((member) => {
                if (importeds.indexOf(member.name) === -1) {
                    importeds.push(member.name)
                }
            })
        })
        node.importeds = importeds
        node.dependencies.forEach(visit)
    }
    rootNode.dependencies.forEach(visit)
}

module.exports = addImporteds
