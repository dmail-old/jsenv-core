var getBestAgent = require('./get-best-agent.js');

var featureMeta = require('./util/feature-meta.js');

function recordIsMissing(record) {
    return (
        record.data.valid === false &&
        record.data.reason === 'file-not-found'
    );
}
function recordIsInvalid(record) {
    return record.data.valid === false;
}
function recordIsFailed(record) {
    return record.data.value.status === 'failed';
}
function getStatus(featureId, agent, includeFix, enableBestAgent) {
    var featureAgentPromise;
    if (enableBestAgent) {
        featureAgentPromise = getBestAgent(featureId, agent);
    } else {
        featureAgentPromise = Promise.resolve(agent);
    }
    return featureAgentPromise.then(
        function(featureAgent) {
            return featureMeta.getTest(
                featureId,
                featureAgent
            ).then(function(testRecord) {
                if (recordIsMissing(testRecord)) {
                    return 'test-missing';
                }
                if (recordIsInvalid(testRecord)) {
                    return 'test-invalid';
                }
                if (recordIsFailed(testRecord)) {
                    if (includeFix) {
                        return featureMeta.getFix(
                            featureId,
                            featureAgent
                        ).then(function(fixRecord) {
                            if (recordIsMissing(fixRecord)) {
                                return 'test-failed-and-fix-missing';
                            }
                            if (recordIsInvalid(fixRecord)) {
                                return 'test-failed-and-fix-invalid';
                            }
                            if (recordIsFailed(fixRecord)) {
                                return 'test-failed-and-fix-failed';
                            }
                            return 'test-failed-and-fix-passed';
                        });
                    }
                    return 'test-failed';
                }
                return 'test-passed';
            });
        },
        function(e) {
            if (e && (e.code === 'NO_AGENT' || e.code === 'NO_AGENT_VERSION')) {
                if (includeFix) {
                    return 'test-missing-and-fix-missing';
                }
                return 'test-missing';
            }
            return Promise.reject(e);
        }
    );
}

module.exports = getStatus;
