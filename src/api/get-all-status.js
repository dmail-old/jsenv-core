var getStatus = require('./get-status.js');

var mapAsync = require('./util/map-async.js');
var pathFromId = require('./util/path-from-id.js');
var fsAsync = require('./util/fs-async.js');

function getAllStatus(featureIds) {
    function getAllVersionStatus(featureId, agentName, versionNames) {
        return mapAsync(versionNames, function(versionName) {
            var agent = agentName + '/' + versionName;
            return getStatus(featureId, agent, true).then(function(statuses) {
                return {name: versionName, testStatus: statuses[0], fixStatus: statuses[1]};
            });
        });
    }
    function getAllAgentStatus(featureId, agentNames) {
        var featureFolder = pathFromId(featureId);
        var featureCacheFolder = featureFolder + '/.cache';
        var results = [];

        return mapAsync(agentNames, function(agentName) {
            var agentFolder = featureCacheFolder + '/' + agentName;
            return fsAsync('readdir', agentFolder).then(function(agentVersions) {
                return getAllVersionStatus(featureId, agentName, agentVersions).then(function(versions) {
                    results = results.concat(versions.map(function(version) {
                        return {
                            agent: agentName + '/' + version.name,
                            testStatus: version.testStatus,
                            fixStatus: version.fixStatus
                        };
                    }));
                });
            });
        }).then(function() {
            return results;
        });
    }
    function getAllFeatureStatus(featureId) {
        var featureFolder = pathFromId(featureId);
        var featureCacheFolder = featureFolder + '/.cache';
        return fsAsync('readdir', featureCacheFolder).then(function(agentNames) {
            return getAllAgentStatus(featureId, agentNames);
        });
    }

    return mapAsync(featureIds, getAllFeatureStatus);
}

module.exports = getAllStatus;

// getAllStatus(
//     ['symbol']
// ).then(function(agentStatuses) {
//     console.log('status', agentStatuses);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
