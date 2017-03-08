var getAllStatus = require('./get-all-status.js');

var find = require('./util/find.js');

function getAllSupportedAgent(featureIds) {
    return getAllStatus(featureIds).then(function(allFeatureStatus) {
        var supportedAgents = [];
        allFeatureStatus.forEach(function(allFeatureAgentStatus) {
            var supportedAgent = find(allFeatureAgentStatus, function(agentStatus) {
                return (
                    agentStatus.testStatus === 'passed' ||
                    agentStatus.fixStatus === 'passed'
                );
            });
            if (supportedAgent) {
                supportedAgents.push(supportedAgent.agent);
            }
        });
        return supportedAgents;
    });
}

module.exports = getAllSupportedAgent;

// getAllSupportedAgent(
//     ['object/assign']
// ).then(function(result) {
//     console.log('result', result);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
