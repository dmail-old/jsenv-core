function markImportedExport(rootNode) {
    function visit(node) {
        var importeds = [];
        node.dependents.forEach(function(dependent) {
            var index = dependent.dependencies.indexOf(node);
            var importation = dependent.importations[index];
            importation.forEach(function(member) {
                if (importeds.indexOf(member.name) === -1) {
                    importeds.push(member.name);
                }
            });
        });
        node.importeds = importeds;
        node.dependencies.forEach(visit);
    }
    rootNode.dependencies.forEach(visit);
}

module.exports = markImportedExport;
