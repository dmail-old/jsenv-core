var getFeaturesFolder = require('./get-features-folder.js');
var fsAsync = require('../fs-async.js');

function readFolder(path) {
    return fsAsync('readdir', path);
}
function recursivelyReadFolderFeatureNames(path) {
    var featureNames = [];

    function readFolderFeatureNames(parentName) {
        var featureFolderPath;
        if (parentName) {
            featureFolderPath = path + '/' + parentName;
        } else {
            featureFolderPath = path;
        }

        return readFolder(featureFolderPath).then(function(ressourceNames) {
            var ressourcePaths = ressourceNames.map(function(name) {
                return featureFolderPath + '/' + name;
            });
            var ressourcesPromise = ressourcePaths.map(function(ressourcePath, index) {
                return fsAsync('stat', ressourcePath).then(function(stat) {
                    var ressourceName = ressourceNames[index];
                    if (stat.isDirectory()) {
                        if (ressourceName[0].match(/[a-z]/)) {
                            var directoryPath = ressourcePath + '/' + ressourceName;
                            var featureName;
                            if (parentName) {
                                featureName = parentName + '/' + ressourceName;
                            } else {
                                featureName = ressourceName;
                            }

                            return Promise.all([
                                fsAsync(
                                    'stat',
                                    directoryPath + '/test.js'
                                ).then(
                                    function(stat) {
                                        if (stat.isFile()) {
                                            featureNames.push(featureName);
                                        }
                                    },
                                    function(e) {
                                        if (e && e.code === 'ENOENT') {
                                            return;
                                        }
                                        return Promise.reject(e);
                                    }
                                ),
                                readFolderFeatureNames(featureName)
                            ]);
                        }
                    }
                });
            });
            return Promise.all(ressourcesPromise);
        });
    }

    return readFolderFeatureNames(null).then(function() {
        return featureNames;
    });
}

function listFeatureNames() {
    return recursivelyReadFolderFeatureNames(getFeaturesFolder());
}

module.exports = listFeatureNames;
