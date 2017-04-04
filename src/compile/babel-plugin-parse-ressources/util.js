/*
helpers to throw errors when code do weird things such as duplicate_export, duplicate_import
& selfReferencingImport
*/

const normalize = (ressources, ressourceOwnerHref, normalize) => {
    return ressources.map((ressource) => {
        if (ressource.type === 'export') {
            return ressource
        }
        return {...ressource, ...{source: normalize(ressource.source, ressourceOwnerHref)}}
    })
}
exports.normalize = normalize

const findDuplicateRessource = (ressources, property) => {
    return ressources.find((ressource, index) => {
        return ressources.findIndex((otherRessource) => {
            return otherRessource[property] === ressource[property]
        }, index) > -1
    })
}

const isExternal = (ressource) => {
    return ressource.type === 'import' || ressource.type === 'reexport'
}

const isInternal = (ressource) => {
    return ressource.type === 'export'
}

const getExternals = (ressources) => {
    return ressources.filter(isExternal)
}
exports.getExternals = getExternals

const getInternals = (ressources) => {
    return ressources.filter(isInternal)
}
exports.getExternals = getExternals

const findInternalDuplicate = (ressources) => {
    const exportedRessources = getInternals(ressources)
    return findDuplicateRessource(exportedRessources, 'name')
}
exports.findInternalDuplicate = findInternalDuplicate

const findExternalDuplicate = (ressources) => {
    const importedRessources = getExternals(ressources)
    return findDuplicateRessource(importedRessources, 'localName')
}
exports.findExternalDuplicate = findExternalDuplicate

const findExternalBySource = (ressources, source) => {
    return ressources.find((ressource) => {
        return isExternal(ressource) && ressource.source === source
    })
}
exports.findExternalBySource = findExternalBySource
