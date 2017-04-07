const traverseGraphAsync = (rootNode, fn) => {
	const visited = []
	const visit = (node, dependent) => {
		if (visited.includes(node)) {
			return
		}
		visited.push(node)

		return fn(node, dependent).then((returnValue) => {
			// when fn returns continue, ignore dependencies
			if (returnValue === "continue") {
				return
			}
			return Promise.all(node.dependencies.map((dependency) => {
				return visit(dependency, node)
			}))
		})
	}
	return visit(rootNode)
}
module.exports = traverseGraphAsync
