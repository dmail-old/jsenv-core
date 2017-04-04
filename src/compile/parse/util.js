/*
check that the tree starting from rootNode
is not missing export
*/

const ressourceUtil = require('../babel-plugin-parse-ressources/util.js')

// https://gitlab.com/Rich-Harris/locate-character/blob/master/src/index.js
const getLocator = (source, options = {}) => {
    const offsetLine = options.offsetLine || 0
    const offsetColumn = options.offsetColumn || 0

    let originalLines = source.split('\n')

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
        if (typeof search === 'string') {
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
    if (typeof options === 'number') {
        throw new Error('locate takes a { startIndex, offsetLine, offsetColumn } object as the third argument')
    }
    return getLocator(source, options)(search, options && options.startIndex)
}

// https://github.com/rollup/rollup/blob/master/src/utils/getCodeFrame.js
const spaces = (i) => {
    let result = ''
    while (i--) {
        result += ' '
    }
    return result
}
const tabsToSpaces = (str) => {
    return str.replace(/^\t+/, (match) => match.split('\t').join('  '))
}
const getCodeFrame = (source, line, column) => {
    let lines = source.split('\n')

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
            const indicator = spaces(digits + 2 + tabsToSpaces(str.slice(0, column)).length) + '^'
            return `${lineNum}: ${tabsToSpaces(str)}\n${indicator}`
        }

        return `${lineNum}: ${tabsToSpaces(str)}`
    }).join('\n')
}
exports.getCodeFrame = getCodeFrame

const getNodeFrame = (node, index) => {
    const code = node.code
    const {line, column} = locateCharacter(code, index, {offsetLine: 1})
    const location = {
        file: node.href,
        line,
        column,
        frame: getCodeFrame(code, line, column)
    }
    return location
}
exports.getNodeFrame = getNodeFrame

const getMissingExport = (rootNode) => {
    const getRessourceDependency = (node, ressource) => {
        return node.dependencies.find((dependency) => {
            return dependency.href === ressource.source
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
            const dependency = getRessourceDependency(node, ressource)
            return dependency.ressources.some((dependencyRessource) => {
                return (
                    ressourceUtil.isInternal(dependencyRessource) &&
                    dependencyRessource.name === ressource.name
                )
            })
        })
        if (externalRessourceNotExported) {
            return {node, ressource: externalRessourceNotExported}
        }
        node.dependencies.forEach(visit)
    }
    return visit(rootNode)
}
exports.getMissingExport = getMissingExport
