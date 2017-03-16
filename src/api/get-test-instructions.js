var selectAll = require('./util/select-all.js');

function getTestInstructions(featureIds, agent) {
    return selectAll(
        featureIds,
        'test.js',
        {
            agent: agent,
            include: function(statuses) {
                var testStatus = statuses[0];

                return (
                    testStatus === 'missing' ||
                    testStatus === 'invalid'
                );
            },
            generate: true
        }
    ).then(function(result) {
        return result.code;
    });
}

module.exports = getTestInstructions;

// getTestInstructions(
//     ['object/assign'],
//     jsenv.agent
// ).then(function(data) {
//     console.log('required test data', data);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
