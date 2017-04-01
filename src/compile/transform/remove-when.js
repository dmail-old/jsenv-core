/*

- ça fonctionne, une chose qu'il faut aussi faire c'est que lorsqu'un import fait
uniquement partie d'un noeud filtered, il devient filtered

- maintenant il être capable de reconnaitre les imports à supprimer
et aussi pouvoir remplacer les variable des imports

*/

// var mapAsync = require('../api/util/map-async.js');

function removeWhen(node, fn) {
    const removedNodes = []

    function removeDependenciesWhen(node) {
        return node.dependencies.reduce(function(previous, dependency) {
            return previous.then(function() {
                return fn(dependency)
            }).then(function(isFiltered) {
                if (isFiltered) {
                    removedNodes.push(dependency)
                    dependency.dependents.forEach(function(dependent) {
                        var index = dependent.dependencies.indexOf(dependency)
                        var importation = dependent.importations[index]
                        if (importation.length > 0) {
                            throw new Error('cannot remove a named import')
                        }
                        dependent.dependencies.splice(index, 1)
                        dependent.importations.splice(index, 1)
                    })
                }
                return removeDependenciesWhen(dependency)
            })
        }, Promise.resolve())
    }

    return removeDependenciesWhen(node).then(function() {
        return removedNodes
    })
}
module.exports = removeWhen

// var parse = require('./parse.js');
// parse('src/trace/fixtures/conditional/entry.js').then(function(trace) {
//     return removeWhen(trace.root, function(node) {
//         return node.id === 'src/trace/fixtures/conditional/file.js';
//     }).then(function(removed) {
//         console.log('removed', removed);
//         console.log('resulting in a trace', trace);
//     });
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
