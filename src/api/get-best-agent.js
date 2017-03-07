var fsAsync = require('./util/fs-async.js');
var find = require('./util/find.js');
var pathFromId = require('./util/path-from-id.js');

function visibleFallback(path, fallback) {
    return fsAsync.visible(path).catch(function() {
        return Promise.resolve(fallback()).then(function(fallbackPath) {
            if (fallbackPath) {
                return fsAsync.visible(fallbackPath);
            }
        });
    });
}
function adaptAgentName(agent, path) {
    return visibleFallback(
        path + '/' + agent.name,
        function() {
            agent.name = 'other';
            return path + '/' + agent.name;
        }
    );
}
function missingAgent(featureId, agent) {
    var missing = {
        code: 'NO_AGENT',
        featureId: featureId,
        agentName: agent.name
    };
    return missing;
}
function missingVersion(featureId, agent) {
    var missing = {
        code: 'NO_AGENT_VERSION',
        featureId: featureId,
        agentName: agent.name,
        agentVersion: agent.version.toString()
    };
    return missing;
}
function adaptAgentVersion(version, path) {
    var cachePath = path + '/' + version + '/test-output.json';
    return visibleFallback(
        cachePath,
        function() {
            return fsAsync('readdir', path).then(function(names) {
                var availableVersions = names.map(function(name) {
                    return jsenv.createVersion(name);
                }).filter(function(version) {
                    // exclude folder name like ?, * or alphabetic
                    return version.isSpecified();
                }).sort(function(a, b) {
                    if (a.above(b)) {
                        return 1;
                    }
                    if (a.below(b)) {
                        return -1;
                    }
                    return 0;
                });

                var i = 0;
                var j = availableVersions.length;
                var previousVersions = [];
                while (i < j) {
                    var availableVersion = availableVersions[i];
                    if (version.above(availableVersion)) {
                        previousVersions.unshift(availableVersion);
                    } else {
                        break;
                    }
                    i++;
                }
                return Promise.all(previousVersions.map(function(previousVersion) {
                    return fsAsync.visible(path + '/' + previousVersion + '/test-output.json').then(
                        function() {
                            // console.log('valid previous version ' + previousVersion);
                            return true;
                        },
                        function() {
                            // console.log('invalid previous version ' + previousVersion);
                            return false;
                        }
                    );
                })).then(function(validities) {
                    return find(previousVersions, function(previousVersion, index) {
                        return validities[index];
                    });
                }).then(function(closestPreviousValidVersion) {
                    if (closestPreviousValidVersion) {
                        version.update(closestPreviousValidVersion);
                    } else {
                        version.update('?');
                        return path + '/' + version;
                    }
                });
            });
        }
    );
}

function getBestAgent(featureId, agent) {
    var featureFolderPath = pathFromId(featureId);
    var featureCachePath = featureFolderPath + '/.cache';

    var closestPreviousAgent = jsenv.createAgent(agent.name, agent.version);
    return adaptAgentName(
        closestPreviousAgent,
        featureCachePath
    ).catch(function(e) {
        if (e && e.code === 'ENOENT') {
            return Promise.reject(missingAgent(featureId, agent));
        }
        return Promise.reject(e);
    }).then(function() {
        return adaptAgentVersion(
            closestPreviousAgent.version,
            featureCachePath + '/' + closestPreviousAgent.name
        ).catch(function(e) {
            if (e && e.code === 'ENOENT') {
                return Promise.reject(missingVersion(featureId, agent));
            }
            return Promise.reject(e);
        });
    }).then(function() {
        return closestPreviousAgent;
    });
}

module.exports = getBestAgent;

// getBestAgent(
//     'const',
//     jsenv.createAgent('node/4.7.4')
// ).then(function(agent) {
//     console.log('agent', agent.toString());
// }).catch(function(e) {
//     console.log('rejected with', e);
// });
