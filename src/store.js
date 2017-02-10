/* eslint-disable no-use-before-define */

/*
cache/before-fix
-> cache
cache/before-fix/dzuoiuoiusoiuoi
-> branch
cache/before-fix/jkljkjkjkljkl/file.js
-> entry
cache/before-fix/jkljkjkjkljkl/file.js#content
-> data
*/

var cuid = require('cuid');
var fs = require('fs');
var fsAsync = require('./fs-async.js');

var createFileSystemCache = (function() {
    function FileSystemCache(folderPath) {
        this.path = folderPath;
        this.branchesPath = this.path + '/branches.json';
        this.branches = [];
    }

    FileSystemCache.prototype = {
        constructor: FileSystemCache,

        revive: function() {
            var self = this;

            return fsAsync.getFileContent(this.branchesPath, '[]').then(
                JSON.parse
            ).then(function(branches) {
                self.branches = branches.map(function(branchProperties) {
                    return self.branch(branchProperties);
                });
                return self;
            });
        },

        branch: function(properties) {
            properties.path = this.path + '/' + properties.name;
            var branch = createFileSystemCacheBranch(properties);
            return branch;
        },

        match: function(branchMeta) {
            branchMeta = branchMeta || {};
            var branch;
            var branches = this.branches;
            var i = 0;
            var j = branches.length;
            while (i < j) {
                branch = branches[i];
                if (branch.match(branchMeta)) {
                    break;
                } else {
                    branch = null;
                }
                i++;
            }

            if (branch) {
                branch.matchCount = 'matchCount' in branch ? branch.matchCount + 1 : 1;
                branch.lastMatch = Number(Date.now());
                this.update();
                return branch;
            }

            branch = this.branch({
                name: cuid(),
                meta: branchMeta,
                matchCount: 1,
                lastMatch: Number(Date.now())
            });
            branches.push(branch);

            return this.update().then(function() {
                return branch;
            });
        },

        update: function() {
            var branches = this.branches.sort(compareBranch);
            var branchesSource = JSON.stringify(branches, null, '\t');
            this.branches = branches;

            return fsAsync.setFileContent(this.branchesPath, branchesSource).then(function() {
                return branches;
            });
        }
    };

    function compareBranch(a, b) {
        var order;
        var aLastMatch = a.lastMatch;
        var bLastMatch = b.lastMatch;
        var lastMatchDiff = aLastMatch - bLastMatch;

        if (lastMatchDiff === 0) {
            var aMatchCount = a.matchCount;
            var bMatchCount = b.matchCount;
            var matchCountDiff = aMatchCount - bMatchCount;

            order = matchCountDiff;
        } else {
            order = lastMatchDiff;
        }

        return order;
    }

    return function(folderPath) {
        return new FileSystemCache(folderPath).revive();
    };
});

var createFileSystemCacheBranch = (function() {
    function FileSystemCacheBranch(properties) {
        for (var key in properties) { // eslint-disable-line
            this[key] = properties[key];
        }
    }

    FileSystemCacheBranch.prototype = {
        constructor: FileSystemCacheBranch,

        match: function(meta) {
            return JSON.stringify(this.meta) === JSON.stringify(meta);
        },

        entry: function(properties) {
            properties.path = this.path + '/' + properties.name;
            var entry = createFileSystemCacheBranchEntry(properties);
            return entry;
        }
    };

    return function(properties) {
        return new FileSystemCacheBranch(properties);
    };
})();

var createFileSystemCacheBranchEntry = (function() {
    function FileSystemCacheBranchEntry(properties) {
        this.data = {
            valid: undefined,
            value: undefined
        };

        for (var key in properties) { // eslint-disable-line
            this[key] = properties[key];
        }

        var path = this.path;
        var sources = this.sources;
        var format = (function() {
            var dotLastIndex = path.lastIndexOf('.');
            if (dotLastIndex === -1) {
                return 'raw';
            }
            var extension = path.slice(dotLastIndex + 1);
            if (extension === 'json') {
                return 'json';
            }
            return 'raw';
        })();
        if (format === 'json') {
            this.encode = function(value) {
                return JSON.stringify(value, null, '\t');
            };
            this.decode = function(value) {
                return JSON.parse(value);
            };
        }

        var eTagIndex = -1;
        var validators = sources.map(function(source) {
            if (source.strategy === 'mtime') {
                return createMtimeValidator(path, source.path);
            }
            if (source.strategy === 'eTag') {
                if (format !== 'json') {
                    throw new Error('eTag strategy only supported with JSON format');
                }
                eTagIndex++;
                return createEtagValidator(path, source.path, eTagIndex);
            }
            throw new Error('unknown strategy');
        }, this);
        this.prevalidate = composeValidators(validators);

        /*
        eTag ne march qu'avec JSON parce qu'on met les etag dans le fichier json
        à l'aide de wrap/unwrap on cache cette information puisque la propriété
        sources ne sera pas accessible lorsqu'on fera entry.read
        */
        var sourcesUsingEtagStrategy = sources.filter(function(source) {
            return source.strategy === 'eTag';
        });
        if (sourcesUsingEtagStrategy.length) {
            this.wrap = function(value) {
                return Promise.all(
                    sourcesUsingEtagStrategy.map(function(source) {
                        return fsAsync.getFileContentEtag(source.path);
                    })
                ).then(function(eTags) {
                    return {
                        sources: sources.map(function(source, index) {
                            return {
                                path: source.path,
                                eTag: eTags[index]
                            };
                        }),
                        value: value
                    };
                });
            };

            this.unwrap = function(wrappedValue) {
                return wrappedValue.value;
            };
        }
    }

    function createMtimeValidator(path, sourcePath) {
        var debug = false;
        return function() {
            return Promise.all([
                fsAsync.getFileMtime(path),
                fsAsync.getFileMtime(sourcePath)
            ]).then(function(mtimes) {
                var entryMtime = mtimes[0];
                var sourceMtime = mtimes[1];

                if (entryMtime >= sourceMtime) {
                    if (debug) {
                        console.log(path, 'uptodate with', sourcePath);
                    }
                    return true;
                }
                if (debug) {
                    console.log(path, 'outdated against', sourcePath);
                }
                return false;
            });
        };
    }
    function createEtagValidator(path, sourcePath, index) {
        var debug = false;

        return function(value) {
            return fsAsync.getFileContentEtag(sourcePath).then(function(sourceEtag) {
                if (value.sources[index].eTag === sourceEtag) {
                    if (debug) {
                        console.log('etag matching', path, sourcePath);
                    }
                    return true;
                }
                if (debug) {
                    console.log('etag mismatch between', path, 'and', sourcePath);
                }
                return false;
            });
        };
    }
    function composeValidators(validators) {
        var rejectedBecauseInvalid = {};

        return function composedValidator() {
            var self = this;
            var args = arguments;
            var validationPromises = validators.map(function(validator) {
                return Promise.resolve(validator.apply(self, args)).then(function(valid) {
                    if (valid) {
                        return true;
                    }
                    return Promise.reject(rejectedBecauseInvalid);
                });
            });

            return Promise.all(validationPromises).then(function() {
                return true;
            }).catch(function(e) {
                if (e === rejectedBecauseInvalid) {
                    return false;
                }
                return Promise.reject(e);
            });
        };
    }

    var FS_VISIBLE = (fs.constants || fs).F_OK;
    var INVALID = {};
    FileSystemCacheBranchEntry.prototype = {
        constructor: FileSystemCacheBranchEntry,
        mode: 'default',
        prevalidate: function() {
            return true;
        },
        postvalidate: function() {
            return true;
        },
        encode: function(value) {
            return value;
        },
        decode: function(value) {
            return value;
        },
        wrap: function(value) {
            return value;
        },
        unwrap: function(value) {
            return value;
        },
        read: function() {
            var entry = this;
            var path = entry.path;
            var data = entry.data;

            if (this.mode === 'write-only') {
                data.valid = false;
                return Promise.resolve(data);
            }

            return fsAsync('access', path, FS_VISIBLE).catch(function() {
                return Promise.reject(INVALID);
            }).then(function() {
                return Promise.resolve(entry.prevalidate(entry)).then(function(preValidity) {
                    if (!preValidity) {
                        return Promise.reject(INVALID);
                    }
                });
            }).then(function() {
                return fsAsync.getFileContent(path);
            }).then(function(value) {
                data.value = value;
            }).then(function() {
                data.value = entry.decode(data.value);
            }).then(function() {
                return Promise.resolve(entry.postvalidate(entry)).then(function(postValidity) {
                    if (!postValidity) {
                        return Promise.reject(INVALID);
                    }
                });
            }).then(function() {
                data.value = entry.unwrap(data.value);
            }).then(function() {
                data.valid = true;
                return data;
            }).catch(function(value) {
                if (value === INVALID) {
                    data.valid = false;
                    return data;
                }
                return Promise.reject(value);
            }).then(function() {
                if (entry.mode === 'only-if-cached' && data.valid === false) {
                    throw new Error('missing cache at ' + entry.path);
                }
            });
        },
        write: function(value) {
            if (this.mode === 'read-only') {
                return Promise.resolve();
            }

            var entry = this;
            var path = entry.path;
            var data = entry.data;
            data.valid = true;
            data.value = value;

            return Promise.resolve().then(function() {
                data.value = entry.wrap(data.value);
            }).then(function() {
                data.value = entry.encode(data.value);
            }).then(function() {
                return fsAsync.setFileContent(path, data.value);
            });
        }
    };

    return function(properties) {
        return new FileSystemCacheBranchEntry(properties);
    };
})();

var store = {};
store.fileSystemCache = createFileSystemCache;
store.fileSystemBranch = createFileSystemCacheBranch;
store.fileSystemEntry = createFileSystemCacheBranchEntry;
store.memoryEntry = function(value) {
    var data = {
        valid: arguments.length > 0,
        value: value
    };

    return {
        read: function() {
            return Promise.resolve().then(function() {
                return data;
            });
        },

        write: function(value) {
            data.valid = true;
            data.value = value;
            return Promise.resolve();
        }
    };
};

module.exports = store;
