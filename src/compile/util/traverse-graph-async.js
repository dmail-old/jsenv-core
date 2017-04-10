const ensureThenable = require('./ensure-thenable.js')

const traverseGraphAsync = (rootNode, fn) => {
	fn = ensureThenable(fn)
	const visited = []
	const visit = (node, dependent) => {
		if (visited.includes(node)) {
			return
		}
		visited.push(node)

		return fn(node, dependent).then((returnValue) => {
			// when fn returns skip, skip dependencies
			if (returnValue === "skip") {
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
