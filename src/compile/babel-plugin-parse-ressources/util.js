const isExternal = (ressource) => {
    return ressource.type === 'import' || ressource.type === 'reexport'
}
exports.isExternal = isExternal

const isInternal = (ressource) => {
    return ressource.type === 'export'
}
exports.isInternal = isInternal

const getExternals = (ressources) => {
    return ressources.filter(isExternal)
}
exports.getExternals = getExternals

const getInternals = (ressources) => {
    return ressources.filter(isInternal)
}
exports.getInternals = getInternals

const bisect = (ressources) => {
    const internals = []
    const externals = []
    for (const ressource of ressources) {
        (isInternal ? internals : externals).push(ressource)
    }
    return [internals, externals]
}
exports.bisect = bisect
