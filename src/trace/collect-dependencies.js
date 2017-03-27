function collectDependencies() {
    var nodes = Array.prototype.slice.call(arguments);
    var dependencies = [];
    function visit(node) {
        if ('dependencies' in node) {
            node.dependencies.forEach(function(dependency) {
                if (nodes.indexOf(node) === -1 && dependencies.indexOf(dependency) === -1) {
                    dependencies.push(dependency);
                    visit(dependency);
                }
            });
        }
    }
    nodes.forEach(visit);
    return dependencies;
}

module.exports = collectDependencies;
