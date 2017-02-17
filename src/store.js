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
var Path = require('path');

var createFileSystemCache = (function() {
    function FileSystemCache(folderPath, options) {
        this.path = folderPath;
        this.branchesPath = this.path + '/branches.json';
        this.branches = [];
        options = options || {};
        for (var key in options) { // eslint-disable-line guard-for-in
            this[key] = options[key];
        }
    }

    FileSystemCache.prototype = {
        constructor: FileSystemCache,

        revive: function() {
            var self = this;
            var path = this.branchesPath;

            return fsAsync.getFileContent(this.branchesPath, '[]').then(function(content) {
                try {
                    return JSON.parse(content);
                } catch (e) {
                    console.error('malformed json at', path, 'got', content);
                    return Promise.reject(e);
                }
            }).then(function(branches) {
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

        find: function(branchMeta) {
            branchMeta = branchMeta || {};
            var branch;
            var branches = this.branches;
            var i = 0;
            var j = branches.length;
            while (i < j) {
                branch = branches[i];
                if (this.matchBranch(branch, branchMeta)) {
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
                name: this.createBranchName(branchMeta),
                meta: branchMeta,
                matchCount: 1,
                firstMatch: Number(Date.now()),
                lastMatch: Number(Date.now())
            });
            branches.push(branch);

            return this.update().then(function() {
                return branch;
            });
        },

        matchBranch: function(branch, meta) {
            return JSON.stringify(branch.meta) === JSON.stringify(meta);
        },

        createBranchName: function() {
            return cuid();
        },

        match: function(meta) {
            var self = this;
            return this.revive().then(function() {
                return self.find(meta);
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

    return function(folderPath, options) {
        return new FileSystemCache(folderPath, options);
    };
})();

var createFileSystemCacheBranch = (function() {
    function FileSystemCacheBranch(properties) {
        for (var key in properties) { // eslint-disable-line
            this[key] = properties[key];
        }
    }

    FileSystemCacheBranch.prototype = {
        constructor: FileSystemCacheBranch,

        toJSON: function() {
            return {
                name: this.name,
                meta: this.meta,
                matchCount: this.matchCount,
                firstMatch: this.firstMatch,
                lastMatch: this.lastMatch
            };
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
            reason: '',
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
            if (this.hasOwnProperty('encode') === false) {
                this.encode = function(value) {
                    return JSON.stringify(value, null, '\t');
                };
            }
            this.decode = function(value) {
                return JSON.parse(value);
            };
        }
        this.format = format;

        var sourcesUsingMtimeStrategy = sources.filter(function(source) {
            return source.strategy === 'mtime';
        });
        var mtimeValidators = sourcesUsingMtimeStrategy.map(function(source) {
            return createMtimeValidator(path, source.path);
        });
        this.prevalidate = function() {
            return composeValidators(mtimeValidators).call(this);
        };

        /*
        eTag ne march qu'avec JSON parce qu'on met les etag dans le fichier json
        à l'aide de wrap/unwrap on cache cette information puisque la propriété
        sources ne sera pas accessible lorsqu'on fera entry.read
        */
        var sourcesUsingEtagStrategy = sources.filter(function(source) {
            return source.strategy === 'eTag';
        });
        var eTagIndex = -1;
        var eTagValidators = sourcesUsingEtagStrategy.map(function(source) {
            if (format !== 'json') {
                throw new Error('eTag strategy only supported with JSON format');
            }
            eTagIndex++;
            return createEtagValidator(path, source.path, eTagIndex);
        });
        this.postvalidate = function() {
            return composeValidators(eTagValidators).call(this);
        };
        if (sourcesUsingEtagStrategy.length) {
            this.wrap = function(value) {
                var entry = this;
                return Promise.all(
                    sourcesUsingEtagStrategy.map(function(source) {
                        return fsAsync.getFileContentEtag(source.path);
                    })
                ).then(function(eTags) {
                    return {
                        sources: sources.map(function(source, index) {
                            return {
                                path: Path.relative(entry.path, source.path).replace(/\\/g, '/'),
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
        return function() {
            return Promise.all([
                fsAsync.getFileMtime(path),
                fsAsync.getFileMtime(sourcePath)
            ]).then(function(mtimes) {
                var entryMtime = mtimes[0];
                var sourceMtime = mtimes[1];
                var detail = {
                    path: path,
                    mtime: entryMtime,
                    sourcePath: sourcePath,
                    sourceMtime: sourceMtime
                };

                if (entryMtime >= sourceMtime) {
                    return {
                        status: 'valid',
                        reason: 'mtime-up-to-date',
                        detail: detail
                    };
                }
                return {
                    status: 'invalid',
                    reason: 'mtime-outdated',
                    detail: detail
                };
            });
        };
    }
    function createEtagValidator(path, sourcePath, index) {
        return function() {
            var entry = this;
            return fsAsync.getFileContentEtag(sourcePath).then(function(sourceEtag) {
                var expectedEtag = entry.data.value.sources[index].eTag;
                var detail = {
                    path: path,
                    expectedEtag: expectedEtag,
                    sourcePath: sourcePath,
                    sourceEtag: sourceEtag
                };
                if (expectedEtag === sourceEtag) {
                    return {
                        status: 'valid',
                        reason: 'etag-match',
                        detail: detail
                    };
                }
                return {
                    status: 'invalid',
                    reason: 'etag-mismatch',
                    detail: detail
                };
            });
        };
    }
    function composeValidators(validators) {
        return function composedValidator() {
            var self = this;
            var args = arguments;
            var entry = this;
            var data = entry.data;
            var validationPromises = validators.map(function(validator) {
                return Promise.resolve(validator.apply(self, args)).then(function(result) {
                    if (typeof result === 'boolean') {
                        data.valid = result;
                    }
                    if (typeof result === 'object') {
                        data.valid = result.status === 'valid';
                        data.reason = result.reason;
                        data.detail = result.detail;
                    }
                    if (!data.valid) {
                        return Promise.reject(data);
                    }
                });
            });

            return Promise.all(validationPromises).then(function() {
                return true;
            }).catch(function(e) {
                if (e === data) {
                    return false;
                }
                return Promise.reject(e);
            });
        };
    }

    var FS_VISIBLE = (fs.constants || fs).F_OK;
    FileSystemCacheBranchEntry.prototype = {
        constructor: FileSystemCacheBranchEntry,
        mode: 'default', // 'write-only', // utile pour le debug
        limit: { // todo, deux strategy possible : 'ignore' (on ne cache plus rien) et 'lru'
            value: Infinity,
            strategy: 'least-recently-used'
        },
        prevalidate: function() {
            this.data.valid = true;
        },
        postvalidate: function() {
            this.data.valid = true;
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
                data.reason = 'write-only-mode';
                return Promise.resolve(data);
            }

            return fsAsync('access', path, FS_VISIBLE).catch(function() {
                data.valid = false;
                data.reason = 'file-not-found';
                data.detail = {
                    path: path
                };
                return Promise.reject(data);
            }).then(function() {
                return entry.prevalidate();
            }).then(function() {
                if (data.valid === false) {
                    return Promise.reject(data);
                }
            }).then(function() {
                return fsAsync.getFileContent(path);
            }).then(function(value) {
                data.value = value;
            }).then(function() {
                return entry.decode(data.value);
            }).then(function(decodedValue) {
                data.value = decodedValue;
                return entry.postvalidate();
            }).then(function() {
                if (data.valid === false) {
                    return Promise.reject(data);
                }
            }).then(function() {
                return entry.unwrap(data.value);
            }).then(function(unwrappedValue) {
                data.value = unwrappedValue;
                data.valid = true;
                return data;
            }).catch(function(value) {
                if (value === data) {
                    return data;
                }
                return Promise.reject(value);
            }).then(function() {
                if (entry.mode === 'only-if-cached' && data.valid === false) {
                    throw new Error('missing cache at ' + entry.path);
                }
                return data;
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
                return entry.wrap(data.value);
            }).then(function(wrappedValue) {
                return entry.encode(wrappedValue);
            }).then(function(encodedValue) {
                return fsAsync.setFileContent(path, encodedValue);
            }).then(function() {
                return value;
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
            return Promise.resolve(value);
        }
    };
};
store.objectEntry = function(object, propertyName) {
    var data = {
        valid: propertyName in object,
        value: object[propertyName]
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
            object[propertyName] = value;
            return Promise.resolve(value);
        }
    };
};

module.exports = store;
