var getStatus = require('./get-status.js');

var mapAsync = require('./util/map-async.js');

function getAllAgentStatus(featureIds, agent) {
    return mapAsync(featureIds, function(featureId) {
        return getStatus(featureId, agent, true);
    });
}

module.exports = getAllAgentStatus;

// getAllAgentStatus(
//     ['symbol'],
//     'node/0.12.3'
// ).then(function(result) {
//     console.log('result', result);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
