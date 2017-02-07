var cuid = require('cuid');
var fsAsync = require('./fs-async.js');

function add() {
    var i = arguments.length;
    var total = 0;
    while (i--) {
        total += arguments[i];
    }
    return total;
}
function getEntryLastMatch(entry) {
    return Math.max.apply(null, entry.branches.map(function(branch) {
        return branch.lastMatch;
    }));
}
function getEntryMatchCount(entry) {
    return add.apply(null, entry.branches.map(function(branch) {
        return branch.matchCount;
    }));
}
function compareEntry(a, b) {
    var order;
    var aLastMatch = getEntryLastMatch(a);
    var bLastMatch = getEntryLastMatch(b);
    var lastMatchDiff = aLastMatch - bLastMatch;

    if (lastMatchDiff === 0) {
        var aMatchCount = getEntryMatchCount(a);
        var bMatchCount = getEntryMatchCount(b);
        var matchCountDiff = aMatchCount - bMatchCount;

        order = matchCountDiff;
    } else {
        order = lastMatchDiff;
    }

    return order;
}
function getFileStore(folderPath, condition) {
    var entriesPath = folderPath + '/entries.json';

    return fsAsync.getFileContent(entriesPath, '[]').then(JSON.parse).then(function(entries) {
        var store = {
            path: folderPath,

            match: function(meta) {
                meta = meta || {};
                var entry;
                var i = 0;
                var j = entries.length;
                while (i < j) {
                    entry = entries[i];
                    if (condition(entry.meta, meta)) {
                        break;
                    } else {
                        entry = null;
                    }
                    i++;
                }

                if (entry) {
                    entry.matchCount = 'matchCount' in entry ? entry.matchCount + 1 : 1;
                    entry.lastMatch = Number(Date.now());
                    store.update();
                    return entry;
                }

                entry = {
                    name: cuid(),
                    meta: meta,
                    matchCount: 1,
                    lastMatch: Number(Date.now())
                };
                entry.path = store.path + '/' + entry.name;
                entries.push(entry);

                return store.update().then(function() {
                    return entry;
                });
            },

            update: function() {
                entries = entries.sort(compareEntry);

                return fsAsync.setFileContent(entriesPath, JSON.stringify(entries, null, '\t')).then(function() {
                    return entries;
                });
            }
        };

        return store;
    });
}

module.exports = getFileStore;
