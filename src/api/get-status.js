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
function getTestStatus(testRecord) {
    if (recordIsMissing(testRecord)) {
        return 'missing';
    }
    if (recordIsInvalid(testRecord)) {
        return 'invalid';
    }
    if (recordIsFailed(testRecord)) {
        return 'failed';
    }
    return 'passed';
}
function getFixStatus(fixRecord) {
    if (recordIsMissing(fixRecord)) {
        return 'missing';
    }
    if (recordIsInvalid(fixRecord)) {
        return 'invalid';
    }
    if (recordIsFailed(fixRecord)) {
        return 'failed';
    }
    return 'passed';
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
            function getTestRecord() {
                return featureMeta.getTest(
                    featureId,
                    featureAgent
                );
            }
            function getFixRecord() {
                return featureMeta.getFix(
                    featureId,
                    featureAgent
                );
            }

            if (includeFix) {
                return Promise.all([
                    getTestRecord(),
                    getFixRecord()
                ]).then(function(data) {
                    return [
                        getTestStatus(data[0]),
                        getFixStatus(data[1])
                    ];
                });
            }
            return getTestRecord().then(function(testRecord) {
                return [
                    getTestStatus(testRecord)
                ];
            });
        },
        function(e) {
            if (e && (e.code === 'NO_AGENT' || e.code === 'NO_AGENT_VERSION')) {
                if (includeFix) {
                    return [
                        'missing',
                        'missing'
                    ];
                }
                return [
                    'missing'
                ];
            }
            return Promise.reject(e);
        }
    );
}

module.exports = getStatus;
