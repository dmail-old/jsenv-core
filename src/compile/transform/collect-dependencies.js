const collectDependencies = (...nodes) => {
	const dependencies = []
	const visit = (node) => {
		if ("dependencies" in node) {
			node.dependencies.forEach((dependency) => {
				if (nodes.includes(node) === false && dependencies.includes(dependency) === false) {
					dependencies.push(dependency)
					visit(dependency)
				}
			})
		}
	}
	nodes.forEach(visit)
	return dependencies
}

module.exports = collectDependencies
