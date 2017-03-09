var getAllStatus = require('./get-all-status.js');

var find = require('./util/find.js');

function getFirstSupportedAgentVersion(featureId, agentName) {
    return getAllStatus([featureId]).then(function(allFeatureStatus) {
        var featureStatus = allFeatureStatus[0];
        var allAgentStatus = featureStatus.filter(function(stuff) {
            return stuff.agent.split('/')[0] === agentName;
        });
        var supportedAgent = find(allAgentStatus, function(stuff) {
            return (
                stuff.testStatus === 'passed' ||
                stuff.fixStatus === 'passed'
            );
        });
        if (supportedAgent) {
            return String(supportedAgent.agent).split('/')[1];
        }
        return null;
    });
}

module.exports = getFirstSupportedAgentVersion;

// getFirstSupportedAgentVersion(
//     ['object/assign'],
//     'node'
// ).then(function(result) {
//     console.log('result', result);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
