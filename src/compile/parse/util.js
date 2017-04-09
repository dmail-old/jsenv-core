const ressourceUtil = require("../babel-plugin-parse-ressources/util.js")

// https://gitlab.com/Rich-Harris/locate-character/blob/master/src/index.js
const getLocator = (source, options = {}) => {
	const offsetLine = options.offsetLine || 0
	const offsetColumn = options.offsetColumn || 0

	let originalLines = source.split("\n")

	let start = 0
	let lineRanges = originalLines.map((line, i) => {
		const end = start + line.length + 1
		const range = {start, end, line: i}

		start = end
		return range
	})

	let i = 0

	function rangeContains(range, index) {
		return range.start <= index && index < range.end
	}

	function getLocation(range, index) {
		return {line: offsetLine + range.line, column: offsetColumn + index - range.start, character: index}
	}

	return function locate(search, startIndex) {
		if (typeof search === "string") {
			search = source.indexOf(search, startIndex || 0)
		}

		let range = lineRanges[i]
		const d = search >= range.end ? 1 : -1
		while (range) {
			if (rangeContains(range, search)) {
				return getLocation(range, search)
			}
			i += d
			range = lineRanges[i]
		}
	}
}
const locateCharacter = (source, search, options) => {
	if (typeof options === "number") {
		throw new Error("locate takes a { startIndex, offsetLine, offsetColumn } object as the third argument")
	}
	return getLocator(source, options)(search, options && options.startIndex)
}

// https://github.com/rollup/rollup/blob/master/src/utils/getCodeFrame.js
const spaces = (i) => {
	let result = ""
	while (i--) {
		result += " "
	}
	return result
}
const tabsToSpaces = (str) => {
	return str.replace(/^\t+/, (match) => match.split("\t").join("  "))
}
// todo : support sourcemap (read sourcemap in source & find true source location)
const getCodeFrame = (code, line, column) => {
	let lines = code.split("\n")

	const frameStart = Math.max(0, line - 3)
	let frameEnd = Math.min(line + 2, lines.length)

	lines = lines.slice(frameStart, frameEnd)
	while (/\S/.test(lines[lines.length - 1]) === false) {
		lines.pop()
		frameEnd -= 1
	}

	const digits = String(frameEnd).length

	return lines.map((str, i) => {
		const isErrorLine = frameStart + i + 1 === line

		let lineNum = String(i + frameStart + 1)
		while (lineNum.length < digits) {
			lineNum = ` ${lineNum}`
		}

		if (isErrorLine) {
			const indicatorIndentation = spaces(digits + 2 + tabsToSpaces(str.slice(0, column)).length)
			return `${lineNum}: ${tabsToSpaces(str)}\n${indicatorIndentation}^`
		}

		return `${lineNum}: ${tabsToSpaces(str)}`
	}).join("\n")
}
exports.getCodeFrame = getCodeFrame

const getContextFrame = ({content, start, file}) => {
	const {line, column} = locateCharacter(content, start, {offsetLine: 1})
	const location = {
		file,
		line,
		column,
		frame: getCodeFrame(content, line, column)
	}
	return location
}
exports.getContextFrame = getContextFrame

const createErrorGenerator = (branches) => {
	const createContextualizedError = (code, data) => {
		const branch = branches.find((branch) => branch.code === code)
		if (!branch) {
			throw new Error(`no error matching code ${code}`)
		}

		let {message} = branch
		if (message) {
			if (typeof message === "function") {
				message = message(data)
			}
		}
		const error = new Error(message)
		error.code = code

		let {context} = branch
		if (context) {
			if (typeof context === "function") {
				context = context(data)
			}
			const frameData = getContextFrame(context)

			// apparement il suffit de copier les bonne props sur l'objet error pour obtenir une erreur cool
			// https://github.com/rollup/rollup/blob/master/src/Module.js#L295
			// https://github.com/rollup/rollup/blob/master/src/utils/error.js#L5
			error.pos = context.start
			error.loc = {
				file: context.file,
				line: frameData.line,
				column: frameData.column
			}
			error.frame = frameData.frame
		}
		return error
	}

	return createContextualizedError
}
exports.createErrorGenerator = createErrorGenerator

const getMissingExport = (rootNode) => {
	const getRessourceDependency = (node, ressource) => {
		return node.dependencies.find((dependency) => {
			return dependency.href === ressource.href
		})
	}

	const visited = []
	const visit = (node) => {
		if (visited.includes(node)) {
			return
		}
		visited.push(node)

		const externalRessources = ressourceUtil.getExternals(node.ressources)
		const externalRessourceNotExported = externalRessources.find((ressource) => {
			if (!ressource.name) {
				return false
			}
			const dependency = getRessourceDependency(node, ressource)
			if (!dependency) {
				throw new Error(`malformed tree: cannot dependency of ${ressource.id}`)
			}
			const dependencyInternals = ressourceUtil.getInternals(dependency.ressources)
			return dependencyInternals.some((dependencyRessource) => (
				dependencyRessource.name === ressource.name
			)) === false
		})
		if (externalRessourceNotExported) {
			return {node, ressource: externalRessourceNotExported}
		}
		node.dependencies.forEach(visit)
	}
	return visit(rootNode)
}
exports.getMissingExport = getMissingExport
