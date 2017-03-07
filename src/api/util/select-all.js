var path = require('path');
var getStatus = require('../get-status.js');

var fsAsync = require('./fs-async.js');
var readDependencies = require('./read-module-dependencies.js');

var featureTranspiler = require('./feature-transpiler.js');
var build = require('./build.js');

var mapAsync = require('./map-async.js');
var idFromNode = require('./id-from-node.js');
var getFolder = require('./get-folder.js');

require('../../jsenv.js');
var Iterable = jsenv.Iterable;
var collectDependencies = jsenv.collectDependencies;

function getAllDependencies(featureIds, file) {
    var featureFiles = featureIds.map(function(featureId) {
        return './' + featureId + '/' + file;
    });
    var folderPath = getFolder();
    return readDependencies(
        featureFiles,
        {
            root: folderPath,
            exclude: function(id) {
                if (id.indexOf(folderPath) !== 0) {
                    return true;
                }
                return path.basename(id) !== file;
            },
            autoParentDependency: function(id) {
                if (file === 'fix.js') {
                    return;
                }
                // si id est dans folderPath mais n'est pas un enfant direct de folderPath
                // folderPath/a/file.js non
                // mais folderpath/a/b/file.js oui et on renvoit folderpath/a/file.js
                // seulement si mode === 'test' ?

                // file must be inside folder
                if (id.indexOf(folderPath) !== 0) {
                    return;
                }
                var relative = id.slice(folderPath.length + 1);
                var relativeParts = relative.split('/');
                // folderPath/a/file.js -> nope
                if (relativeParts.length < 3) {
                    return;
                }
                // folderpath/a/b/file.js -> yep
                var possibleParentFile = folderPath + '/' + relativeParts.slice(0, -2) + '/' + file;
                return fsAsync.visible(possibleParentFile).then(
                    function() {
                        return possibleParentFile;
                    },
                    function() {
                        return null;
                    }
                );
            }
        }
    );
}
function filterAllNodes(featureIds, file, options) {
    return getAllDependencies(featureIds, file).then(function(nodes) {
        var dependenciesNodes = jsenv.collectDependencies(nodes);
        var allNodes = nodes.concat(dependenciesNodes);

        if (options.include) {
            return mapAsync(allNodes, function(node) {
                var featureId = idFromNode(node);
                // console.log('get status of', featureId);
                return getStatus(
                    featureId,
                    options.agent,
                    options.needFixStatus,
                    options.fallbackBestAgentStatus
                );
            }).then(function(statuses) {
                if (options.ensure) {
                    options.ensure(allNodes, statuses);
                }
                return allNodes.filter(function(node, index) {
                    return options.include(
                        statuses[index],
                        node,
                        Iterable.includes(dependenciesNodes, node)
                    );
                });
            }).then(function(filteredNodes) {
                if (options.ignoreDependencies) {
                    return filteredNodes;
                }
                return filteredNodes.concat(collectDependencies(filteredNodes));
            });
        }
        return allNodes;
    });
}
function selectAll(featureIds, file, options) {
    options = options || {};

    return filterAllNodes(
        featureIds,
        file,
        options
    ).then(function(nodes) {
        var abstractFeatures = nodes.map(function(node) {
            var featureId = idFromNode(node);
            var abstractFeature = {
                id: {
                    type: 'inline',
                    name: '',
                    from: featureId
                }
            };

            if (file === 'test.js') {
                abstractFeature.testDependencies = {
                    type: 'inline',
                    name: '',
                    from: node.dependencies.map(function(dependency) {
                        return nodes.indexOf(dependency);
                    })
                };
                abstractFeature.test = {
                    type: 'import',
                    name: 'default',
                    from: './' + featureId + '/' + file
                };
            } else {
                abstractFeature.fix = {
                    type: 'import',
                    name: 'default',
                    from: './' + featureId + '/' + file
                };
                abstractFeature.fixDependencies = {
                    type: 'inline',
                    name: '',
                    from: node.dependencies.filter(function(dependency) {
                        return Iterable.includes(nodes, dependency);
                    }).map(function(dependency) {
                        return nodes.indexOf(dependency);
                    })
                };
            }
            return abstractFeature;
        });

        return {
            nodes: nodes,
            abstractFeatures: abstractFeatures
        };
    }).then(function(result) {
        var generate;
        var compile;
        var instantiate;
        if (options.instantiate) {
            generate = true;
            compile = true;
            instantiate = true;
        } else if (options.compile) {
            generate = true;
            compile = true;
            instantiate = false;
        } else if (options.generate) {
            generate = true;
            compile = false;
            instantiate = false;
        }

        if (generate) {
            var abstractFeatures = result.abstractFeatures;

            return build(
                abstractFeatures,
                {
                    root: getFolder(),
                    transpiler: featureTranspiler
                }
            ).then(function(bundle) {
                if (generate) {
                    result.code = bundle.code;
                }
                if (compile) {
                    result.data = bundle.compile();
                    if (instantiate) {
                        result.features = result.data.features;
                    }
                }
                return result;
            });
        }
        return result;
    });
}

module.exports = selectAll;
