/*

*/

const babel = require("babel-core")
const fs = require("fs")

const mapAsync = require("../../api/util/map-async.js")
const resolveIfNotPlain = require("./resolve-if-not-plain.js")
const createReplaceImportVariables = require(
	"../babel-plugin-transform-replace-import-variables/create-replace-import-variables.js"
)
const createParseRessources = require(
	"../babel-plugin-parse-ressources/create-parse-ressources.js"
)
const ressourceUtil = require("../babel-plugin-parse-ressources/util.js")
const util = require("./util.js")
// const root = require('path').resolve(process.cwd(), '../../../').replace(/\\/g, '/')
// const rootHref = 'file:///' + root
const ensureThenable = require("../util/ensure-thenable.js")

const getNodeFilename = (filename) => {
	filename = String(filename)

	var nodeFilename
	if (filename.indexOf("file:///") === 0) {
		nodeFilename = filename.slice("file:///".length)
	}
	else {
		nodeFilename = filename
	}
	return nodeFilename
}
const readSource = (filename) => {
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
const normalize = (path) => path.replace(/\\/g, "/")

const contextualizeError = ({node, ressource}) => {
	const context = {
		file: node.href,
		content: node.content,
		start: ressource.start
	}
	return context
}
const possibleErrors = [
	{
		code: "RESOLVE_ENTRY_ERROR",
		message: ({entryRelativeHref, error}) => (
			`Error resolving entry ${entryRelativeHref} : ${error}`
		)
	},
	{
		code: "FETCH_ENTRY_ERROR",
		message: ({node, error}) => (
			`Error fetching entry ${node.href}: ${error}`
		)
	},
	{
		code: "RESOLVE_ERROR",
		message: ({ressource, node}) => (
			`Error resolving '${ressource.source}' from ${node.id}`
		),
		context: contextualizeError
	},
	{
		code: "FETCH_ERROR",
		message: ({ressource, node}) => (
			`Error fetching '${ressource.source}' from ${node.id}`
		),
		context: contextualizeError
	},
	{
		code: "DUPLICATE_EXPORT_DEFAULT",
		message: () => (
			"A module can only have one default export"
		),
		context: contextualizeError
	},
	{
		code: "DUPLICATE_EXPORT",
		message: ({ressource}) => (
			`A module cannot have multiple exports with the same name ('${ressource.name}')`
		),
		context: contextualizeError
	},
	// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L219
	{
		code: "DUPLICATE_IMPORT",
		message: ({ressource}) => (
			`Duplicated import of ('${ressource.localName}')`
		),
		context: contextualizeError
	},
	{
		code: "DUPLICATE_REEXPORT",
		message: ({ressource}) => (
			`Duplicated reexport of ('${ressource.localName}')`
		),
		context: contextualizeError
	},
	// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Bundle.js#L400
	{
		code: "SELF_IMPORT",
		message: () => (
			"A module cannot import from itself"
		),
		context: contextualizeError
	},
	{
		code: "SELF_REEXPORT",
		message: () => (
			"A module cannot export from itself"
		),
		context: contextualizeError
	},
	{
		code: "MISSING_EXPORT",
		message: ({ressource}) => (
			`${ressource.name} is not exported by ${ressource.source}`
		),
		context: contextualizeError
	}
]
const createError = util.createErrorGenerator(possibleErrors)

function parse(entryRelativeHref, options = {}) {
	if (typeof options === 'string') {
		options = {
			baseHref: options
		}
	}

	let {
		variables = {},
		baseHref,
		fetch = (node, readSource) => readSource(node.href),
		resolve,
	} = options

	baseHref = baseHref || process.cwd()
	baseHref = normalize(baseHref)
	if (baseHref[0].match(/[a-z]/i) && baseHref[1] === ':' && baseHref[2] === '/') {
		baseHref = `file:///${baseHref}`
	}

	// ensure trailing / so that we are absolutely sure it's a folder
	if (baseHref[baseHref.length - 1] !== "/") {
		baseHref += "/"
	}
	// baseHref = baseHref.slice(0, baseHref.lastIndexOf('/'))
	resolve = resolve || function(importee, importer) {
		const resolved = resolveIfNotPlain(importee, importer)
		if (resolved) {
			return resolved
		}
		return baseHref + importee
	}
	resolve = ensureThenable(resolve)
	fetch = ensureThenable(fetch)
	const locate = (...args) => resolve(...args).then(normalize)
	const hrefToId = (href) => href.slice(baseHref.length)

	const nodes = []
	const createNode = (href) => {
		const node = {
			id: hrefToId(href),
			href,
			dependencies: [],
			dependents: [],
			ressources: []
		}
		return node
	}
	const findNodeByHref = (href) => {
		return nodes.find((node) => node.href === href)
	}
	const getNode = (href, ressource) => {
		const existingNode = findNodeByHref(href)
		if (existingNode) {
			return existingNode
		}
		const node = createNode(href)
		if (ressource) {
			node.createdByRessource = ressource
		}
		nodes.push(node)
		return node
	}
	const parseRessource = (node) => {
		const ressources = []
		// console.log('transforming', node.href)
		const result = babel.transform(node.content, {
			ast: true,
			code: false,
			sourceMaps: false,
			babelrc: false,
			filename: node.href,
			plugins: [
				createReplaceImportVariables(variables),
				createParseRessources(ressources)
			]
		})
		node.ast = result.ast

		const externalRessources = ressourceUtil.getExternals(ressources)
		return mapAsync(externalRessources, (ressource) => {
			return locate(ressource.source, node.href).then(
				(href) => {
					ressource.href = href
					ressource.id = hrefToId(href)
				},
				(error) => {
					throw createError("RESOLVE_ERROR", {
						node,
						ressource,
						error
					})
				}
			)
		}).then(() => {
			const [internals, externals] = ressourceUtil.bisect(ressources)

			const internalDuplicate = internals.find((ressource, index, array) => {
				return (
					ressource.name &&
					array.slice(index + 1).some((nextRessource) => ressource.name === nextRessource.name)
				)
			})
			// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L125
			if (internalDuplicate) {
				// console.log('internals', internals, 'duplicate', internalDuplicate)
				if (internalDuplicate.name === "default") {
					throw createError(
						"DUPLICATE_EXPORT_DEFAULT",
						{node, ressource: internalDuplicate}
					)
				}
				throw createError(
					"DUPLICATE_EXPORT",
					{node, ressource: internalDuplicate}
				)
			}
			// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L219
			const externalDuplicate = externals.find((ressource, index, array) => {
				return (
					ressource.localName &&
					array.slice(index + 1).some((nextRessource) => ressource.localName === nextRessource.localName)
				)
			})
			if (externalDuplicate) {
				if (externalDuplicate.type === "import") {
					throw createError(
						"DUPLICATE_IMPORT",
						{node, ressource: externalDuplicate}
					)
				}
				if (externalDuplicate.type === "reexport") {
					throw createError(
						"DUPLICATE_REEXPORT",
						{node, ressource: externalDuplicate}
					)
				}
			}
			// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Bundle.js#L400
			const externalSelf = externals.find((ressource) => (
				ressource.href === node.href
			))
			if (externalSelf) {
				if (externalSelf.type === "import") {
					throw createError(
						"SELF_IMPORT",
						{node, ressource: externalSelf}
					)
				}
				if (externalSelf.type === "reexport") {
					throw createError(
						"SELF_REEXPORT",
						{node, ressource: externalSelf}
					)
				}
			}

			return ressources
		})
	}
	const fetchAndParseRessources = (node) => {
		// console.log('fetching', node.id);
		return fetch(node, readSource).then(
			(content) => {
				node.content = content
				return parseRessource(node)
			},
			(error) => {
				if (node.createdByRessource) {
					const ressource = node.createdByRessource
					throw createError(
						"FETCH_ERROR",
						{
							node: node.dependents.find((dependent) => {
								return dependent.href === ressource.href
							}),
							importee: node,
							ressource,
							error,
						}
					)
				}
				throw createError("FETCH_ENTRY_ERROR", {node, error})
			}
		).then((ressources) => {
			node.ressources = ressources
			return ressources
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
				const externalRessources = ressourceUtil.getExternals(ressources)
				const dependencies = []
				externalRessources.forEach((ressource) => {
					const dependency = getNode(ressource.href, ressource)
					if (dependencies.includes(dependency) === false) {
						// console.log(node.id, 'depends on', dependency.id)
						dependencies.push(dependency)
					}
					if (dependency.dependents.includes(node) === false) {
						dependency.dependents.push(node)
					}
				})
				node.dependencies = dependencies

				return mapAsync(dependencies, parseNode)
			})
			parseCache[node.id] = promise
		}

		return promise
	}

	return locate(entryRelativeHref, baseHref).then(
		(entryHref) => {
			const entryNode = getNode(entryHref)
			return parseNode(entryNode).then(() => {
				// https://github.com/rollup/rollup/blob/ae54071232bb7236faf0848941c857f7c534ae09/src/Module.js#L426}
				const missingExport = util.getMissingExport(entryNode)
				if (missingExport) {
					throw createError("MISSING_EXPORT", missingExport)
				}

				return {
					locate,
					fetch,
					root: entryNode
				}
			})
		},
		(error) => {
			throw createError("RESOLVE_ENTRY_ERROR", {entryRelativeHref, error})
		}
	)
}

module.exports = parse

