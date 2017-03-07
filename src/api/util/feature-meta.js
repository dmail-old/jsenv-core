var store = require('./store.js');
var mapAsync = require('./map-async.js');
var pathFromId = require('./path-from-id.js');

function stringifyErrorReplacer(key, value) {
    if (value instanceof Error) {
        var error = {};
        var properties = [];
        var property;
        for (property in value) { // eslint-disable-line guard-for-in
            properties.push(property);
        }
        var nonEnumerableProperties = ["name", "message", "stack"];
        properties.push.apply(properties, nonEnumerableProperties);
        var i = 0;
        var j = properties.length;
        while (i < j) {
            property = properties[i];
            error[property] = value[property];
            i++;
        }

        return error;
    }
    return value;
}
function stringify(value) {
    try {
        return JSON.stringify(value, stringifyErrorReplacer, '\t');
    } catch (e) {
        return '[Circular]';
    }
}
function createTestOutputProperties(featureId, agent) {
    var agentString = agent.toString();
    var featureFolderPath = pathFromId(featureId);
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        path: featureAgentCachePath,
        name: 'test-output.json',
        encode: stringify,
        sources: [
            {
                path: featureFolderPath + '/test.js',
                strategy: 'eTag'
            }
        ],
        // mode: 'write-only'
        mode: 'default'
    };
    return properties;
}
function createFixOutputProperties(featureId, agent) {
    var agentString = agent.toString();
    var featureFolderPath = pathFromId(featureId);
    var featureCachePath = featureFolderPath + '/.cache';
    var featureAgentCachePath = featureCachePath + '/' + agentString;

    var properties = {
        path: featureAgentCachePath,
        name: 'fix-output.json',
        encode: stringify,
        sources: [
            {
                path: featureFolderPath + '/fix.js',
                strategy: 'eTag'
            }
        ],
        // mode: 'write-only'
        mode: 'default'
    };
    return properties;
}
function getFeatureAgentCache(featureId, agent, type) {
    var createProperties;
    if (type === 'test') {
        createProperties = createTestOutputProperties;
    } else {
        createProperties = createFixOutputProperties;
    }

    var properties = createProperties(featureId, agent);
    return store.fileSystemEntry(properties);
}
function readOutputFromFileSystem(featureId, agent, type) {
    var cache = getFeatureAgentCache(featureId, agent, type);
    return cache.read();
}
function writeOutputToFileSystem(featureId, agent, type, output) {
    var cache = getFeatureAgentCache(featureId, agent, type);
    return cache.write(output);
}
function readRecordFromFileSystem(featureId, agent, type) {
    return readOutputFromFileSystem(
        featureId,
        agent,
        type
    ).then(function(data) {
        // if (data.valid) {
        //     console.log('got valid data for', featureId);
        // } else {
        //     console.log('no valid for', featureId, 'because', data.reason);
        // }
        return {
            id: featureId,
            data: data
        };
    });
}
function writeRecordToFileSystem(featureId, agent, type, record) {
    return writeOutputToFileSystem(
        featureId,
        agent,
        type,
        record.data
    ).then(function() {
        return undefined;
    });
}

module.exports = {
    getTest: function(featureId, agent) {
        return readRecordFromFileSystem(featureId, agent, 'test');
    },
    getFix: function(featureId, agent) {
        return readRecordFromFileSystem(featureId, agent, 'fix');
    },
    setTest: function(featureId, agent, testOutput) {
        return writeRecordToFileSystem(featureId, agent, 'test', testOutput);
    },
    setFix: function(featureId, agent, fixOutput) {
        return writeRecordToFileSystem(featureId, agent, 'fix', fixOutput);
    },
    setAllTest: function(testRecords, agent) {
        return mapAsync(testRecords, function(testRecord) {
            return writeRecordToFileSystem(testRecord.id, agent, 'test', testRecord);
        });
    },
    setAllFix: function(fixRecords, agent) {
        return mapAsync(fixRecords, function(fixRecord) {
            return writeRecordToFileSystem(fixRecord.id, agent, 'fix', fixRecord);
        });
    }
};
