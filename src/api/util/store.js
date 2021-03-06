/* eslint-disable new-cap */

var cuid = require('cuid');
var Path = require('path');

var fsAsync = require('./fs-async.js');
var find = require('./find.js');

var createFileSystemEntry = (function() {
    var createFileSystemBranch = (function() {
        function FileSystemBranch(properties) {
            for (var key in properties) { // eslint-disable-line
                this[key] = properties[key];
            }
        }

        FileSystemBranch.prototype = {
            constructor: FileSystemBranch,

            toJSON: function() {
                return {
                    name: this.name,
                    args: this.args,
                    // bind: this.bind,
                    matchCount: this.matchCount,
                    firstMatch: this.firstMatch,
                    lastMatch: this.lastMatch
                };
            }
        };

        return function(properties) {
            return new FileSystemBranch(properties);
        };
    })();

    function createMtimeValidator(sourcePath) {
        return function(path) {
            var entry = this;
            // console.log('prevalidate', path);

            return Promise.all([
                fsAsync.getFileMtime(path).catch(function(e) {
                    if (e && e.code === 'ENOENT') {
                        var data = entry.data;
                        data.valid = false;
                        data.reason = 'file-not-found';
                        data.detail = {
                            path: path
                        };
                        return data;
                    }
                    return Promise.reject(e);
                }),
                fsAsync.getFileMtime(sourcePath).catch(function(e) {
                    // console.log('the source error', sourcePath);
                    if (e && e.code === 'ENOENT') {
                        var data = entry.data;
                        data.valid = false;
                        data.reason = 'mtime-source-not-found';
                        data.detail = {
                            sourcePath: sourcePath
                        };
                        return Promise.reject(data);
                    }
                    return Promise.reject(e);
                })
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
    function createEtagValidator(sourcePath, index) {
        return function(path) {
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
    function FileSystemEntry(properties) {
        this.data = {
            valid: undefined,
            reason: '',
            value: undefined
        };

        for (var key in properties) { // eslint-disable-line
            this[key] = properties[key];
        }

        var name = this.name;
        var sources = this.sources;
        var format = (function() {
            var dotLastIndex = name.lastIndexOf('.');
            if (dotLastIndex === -1) {
                return 'raw';
            }
            var extension = name.slice(dotLastIndex + 1);
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
            return createMtimeValidator(source.path);
        });
        this.prevalidate = function(path) {
            return composeValidators(mtimeValidators).call(this, path);
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
                throw new Error(
                    'eTag strategy supported only with JSON file (not ' + name + ')'
                );
            }
            eTagIndex++;
            return createEtagValidator(source.path, eTagIndex);
        });
        this.postvalidate = function(path) {
            return composeValidators(eTagValidators).call(this, path);
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

    // if two function concurrently ask for a match on inexistent branch
    // we wait for the first function to create unatched branch before letting the second check
    // without this check they would both create a new branch (a duplicate) because none has matched
    var pendingOperations = [];
    function markOperationAsPending(operation) {
        pendingOperations.push(operation);

        operation.thenable.then(
            function() {
                markOperationAsDone(operation);
            },
            function() {
                markOperationAsDone(operation);
            }
        );
    }
    function markOperationAsDone(operation) {
        var index = pendingOperations.indexOf(operation);
        pendingOperations.splice(index, 1);
    }
    function operationCanConflict(pendingOperation, operation) {
        return (
            pendingOperation.meta.path === operation.meta.path && (
                pendingOperation.verb === 'CREATE' ||
                pendingOperation.verb === 'DELETE' ||
                pendingOperation.verb === 'UPDATE'
            )
        );
    }
    function handleOperation(operation) {
        var conflictualOperation = find(pendingOperations, function(pendingOperation) {
            return operationCanConflict(pendingOperation, operation);
        });
        if (conflictualOperation) {
            console.log(
                'wait for', conflictualOperation.verb,
                'on', conflictualOperation.meta.path,
                'before', operation.verb
            );
            return conflictualOperation.thenable.then(
                function() {
                    return handleOperation(operation);
                },
                function() {
                    return handleOperation(operation);
                }
            );
        }
        var thenable = Promise.resolve(operation.fn());
        operation.thenable = thenable;
        markOperationAsPending(operation);
        return thenable;
    }
    function preventCRUDConflict(verb, meta, fn) {
        var operation = {
            verb: verb,
            meta: meta,
            fn: fn
        };
        return handleOperation(operation);
    }

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

    FileSystemEntry.prototype = {
        constructor: FileSystemEntry,
        sources: [],
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
        retrieve: function(path) {
            return fsAsync.getFileContent(path);
        },
        save: function(path, value) {
            return fsAsync.setFileContent(path, value);
        },
        branchMatch: function(branch, normalizedArgs) {
            return JSON.stringify(branch.args) === JSON.stringify(normalizedArgs);
        },
        branch: function(properties) {
            // properties.path = this.path + '/' + properties.name;
            var branch = createFileSystemBranch(properties);
            return branch;
        },
        branchName: function() {
            return cuid();
        },
        normalize: function() {
            var args = arguments;
            return args;
        },
        CREATE: function(branches) {
            var entry = this;
            var branchesPath = entry.path + '/branches.json';

            return preventCRUDConflict(
                'CREATE',
                {
                    path: branchesPath
                },
                function() {
                    var sortedBranches = branches.sort(compareBranch);
                    var branchesSource = JSON.stringify(sortedBranches, null, '\t');

                    return fsAsync.setFileContent(branchesPath, branchesSource).then(function() {
                        return branches;
                    });
                }
            );
        },
        READ: function() {
            var entry = this;
            var branchesPath = entry.path + '/branches.json';

            return preventCRUDConflict(
                'READ',
                {
                    path: branchesPath
                },
                function() {
                    return fsAsync.getFileContent(branchesPath, '[]').then(function(content) {
                        try {
                            return JSON.parse(content);
                        } catch (e) {
                            console.error('malformed json at', branchesPath, 'got', content);
                            return Promise.reject(e);
                        }
                    }).then(function(branches) {
                        return branches.map(function(branchProperties) {
                            return entry.branch(branchProperties);
                        });
                    });
                }
            );
        },
        UPDATE: function(branches) {
            var entry = this;
            var branchesPath = entry.path + '/branches.json';

            return preventCRUDConflict(
                'UPDATE',
                {
                    path: branchesPath
                },
                function() {
                    var sortedBranches = branches.sort(compareBranch);
                    var branchesSource = JSON.stringify(sortedBranches, null, '\t');

                    return fsAsync.setFileContent(branchesPath, branchesSource).then(function() {
                        return branches;
                    });
                }
            );
        },
        DELETE: function() {

        },

        match: function(branches, bind, normalizedArgs) {
            var branch;
            var i = 0;
            var j = branches.length;
            while (i < j) {
                branch = branches[i];
                if (this.branchMatch(branch, normalizedArgs)) {
                    break;
                } else {
                    branch = null;
                }
                i++;
            }
            return {
                branches: branches,
                branch: branch
            };
        },
        read: function(bind, args) {
            var entry = this;
            var data = entry.data;
            if (entry.mode === 'write-only') {
                data.valid = false;
                data.reason = 'write-only-mode';
                return Promise.resolve(data);
            }

            var path = entry.path;
            var normalizedArgs = entry.normalize.apply(entry, args);
            var pathThenable;
            if (entry.behaviour === 'branch') {
                pathThenable = entry.READ().then(function(branches) {
                    return entry.match(branches, bind, normalizedArgs);
                }).then(function(result) {
                    if (result.branch) {
                        var branch = result.branch;
                        var branches = result.branches;
                        branch.matchCount = 'matchCount' in branch ? branch.matchCount + 1 : 1;
                        branch.lastMatch = Number(Date.now());
                        if (entry.trackingEnabled) {
                            entry.UPDATE(branches, entry);
                        }
                        return path + '/' + branch.name + '/' + entry.name;
                    }
                    data.valid = false;
                    data.reason = 'no-match';
                    data.detail = normalizedArgs;
                });
            } else {
                pathThenable = Promise.resolve(entry.path + '/' + entry.name);
            }

            return pathThenable.then(function(path) {
                if (data.valid === false) {
                    return Promise.reject(data);
                }
                data.path = path;
                return Promise.resolve(entry.prevalidate(path)).then(function() {
                    if (data.valid === false) {
                        return Promise.reject(data);
                    }
                    var retrieveArgs = [path];
                    retrieveArgs.push.apply(retrieveArgs, args);
                    return entry.retrieve.apply(entry, retrieveArgs).catch(function(e) {
                        if (e && e.code === 'ENOENT') {
                            data.valid = false;
                            data.reason = 'file-not-found';
                            data.detail = {
                                path: path
                            };
                            return Promise.reject(data);
                        }
                        return Promise.reject(e);
                    });
                }).then(function(value) {
                    data.value = value;
                    return entry.decode(value);
                }).then(function(decodedValue) {
                    data.value = decodedValue;
                    return entry.postvalidate(path);
                }).then(function() {
                    if (data.valid === false) {
                        return Promise.reject(data);
                    }
                });
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
        write: function(value, bind, args) {
            var entry = this;
            var data = entry.data;
            if (entry.mode === 'read-only') {
                return Promise.resolve();
            }
            data.valid = true;
            data.value = value;
            var normalizedArgs = entry.normalize.apply(entry, args);

            var getPathThenable;
            if (entry.behaviour === 'branch') {
                // cherche si une branch match
                // si oui, met à jour le contenu du fichier
                // sinon crée une branche et me le fichier dedans
                getPathThenable = entry.READ().then(function(branches) {
                    return entry.match(branches, bind, normalizedArgs);
                }).then(function(result) {
                    var branchPromise;
                    var branch = result.branch;
                    if (branch) {
                        branchPromise = Promise.resolve(branch);
                    } else {
                        var branches = result.branches;
                        branch = entry.branch({
                            name: entry.branchName(normalizedArgs),
                            args: normalizedArgs,
                            matchCount: 1,
                            firstMatch: Number(Date.now()),
                            lastMatch: Number(Date.now())
                        });
                        branches.push(branch);
                        branchPromise = entry.CREATE(branches, branch).then(function() {
                            return branch;
                        });
                    }
                    return branchPromise.then(function(branch) {
                        return entry.path + '/' + branch.name + '/' + entry.name;
                    });
                });
            } else {
                getPathThenable = Promise.resolve(entry.path + '/' + entry.name);
            }

            var getContentThenable = Promise.resolve(data.value).then(function() {
                return entry.wrap(data.value);
            }).then(function(wrappedValue) {
                return entry.encode(wrappedValue);
            });

            return Promise.all([
                getPathThenable,
                getContentThenable
            ]).then(function(values) {
                var path = values[0];
                var content = values[1];
                data.path = path;
                var saveArgs = [path, content];
                saveArgs.push.apply(saveArgs, args);
                return entry.save.apply(entry, saveArgs);
            }).then(function() {
                return data;
            });
        },
        get: function() {
            return this.read(null, arguments);
        },
        set: function() {
            var args = arguments;
            var firstArg = args[0];
            var rest = Array.prototype.slice.call(args, 1);
            return this.write(firstArg, null, rest);
        }
    };

    return function(properties) {
        return new FileSystemEntry(properties);
    };
})();

var store = {};
store.fileSystemEntry = createFileSystemEntry;
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
store.memoizeEntry = function(options) {
    options = options || {};

    var branches = [];
    function normalizeBind(bind) {
        return options.normalizeBind ? options.normalizeBind(bind) : bind;
    }
    function normalizeArgs(args) {
        return options.normalizeArgs ? options.normalizeArgs.apply(options, args) : args;
    }
    function normalizeState(bind, args) {
        return {
            bind: normalizeBind(bind),
            args: normalizeArgs(args)
        };
    }
    function compareBind(a, b) {
        return options.compareBind ? options.compareBind(a, b) : true;
    }
    function compareArgValue(a, b) {
        return a === b;
    }
    function compareArgs(a, b) {
        if (options.compareArgs) {
            return options.compareArgs(a, b);
        }
        var aLength = a.length;
        var bLength = b.length;
        if (aLength !== bLength) {
            return false;
        }
        var i = 0;
        while (i < aLength) {
            var aValue = a[i];
            var bValue = b[i];
            if (compareArgValue(aValue, bValue) === false) {
                return false;
            }
            i++;
        }
        return true;
    }
    function compareState(a, b) {
        return (
            compareBind(a.bind, b.bind) &&
            compareArgs(a.args, b.args)
        );
    }
    function findBranch(state) {
        return find(branches, function(branch) {
            return compareState(branch.state, state);
        });
    }

    var memoizer = {
        read: function(bind, args) {
            var state = normalizeState(bind, args);
            var branch = findBranch(state);
            if (branch) {
                return {
                    valid: true,
                    value: branch.value
                };
            }
            return {
                valid: false,
                value: undefined
            };
        },

        write: function(value, bind, args) {
            var state = normalizeState(bind, args);
            var branch = findBranch(state);
            if (branch) {
                branch.value = value;
            } else {
                branch = {
                    state: state,
                    value: value
                };
                branches.push(branch);
            }
            return {
                valid: true,
                value: value
            };
        }
    };

    return memoizer;
};

module.exports = store;

// var entry = createFileSystemEntry({
//     path: './cache',
//     name: 'test.js',
//     behaviour: 'branch',
//     normalize: function(a) {
//         return {
//             a: a
//         };
//     },
//     sources: [
//         {
//             path: './cache/branches.json',
//             strategy: 'mtime'
//         }
//     ]
// });

// entry.read(null, ['hello']).then(function(data) {
//     console.log('data', data);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });
