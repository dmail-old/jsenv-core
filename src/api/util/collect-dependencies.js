function includes(iterable, item) {
    return iterable.indexOf(item) > -1;
}

function collectDependencies(nodes) {
    var dependencies = [];
    function visit(node) {
        if ('dependencies' in node) {
            node.dependencies.forEach(function(dependency) {
                if (includes(nodes, dependency)) {
                    return;
                }
                if (includes(dependencies, dependency)) {
                    return;
                }
                dependencies.push(dependency);
                visit(dependency);
            });
        }
    }
    nodes.forEach(visit);
    return dependencies;
}

module.exports = collectDependencies;
