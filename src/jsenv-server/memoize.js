function memoizeAsync(fn, store) {
    if (typeof fn !== 'function') {
        throw new TypeError('memoizeAsync first arg must be a function');
    }

    function memoizedFn() {
        var bind = this;
        var args = arguments;
        return store.read().then(function(entry) {
            if (entry.valid) {
                return entry.value;
            }
            return Promise.resolve(fn.apply(bind, args)).then(function(value) {
                // even if store.write is asynx we ignore if it fails
                // and we don't wait before returning the value
                store.write(value).catch(function(e) {
                    console.warn('error while storing value', e);
                });
                return value;
            });
        });
    }

    return memoizedFn;
}

var fs = require('fs');
var fsAsync = require('./fs-async.js');
function memoizeUsingFile(fn, path, sources, validationStrategy) {
    if (typeof sources === 'string') {
        sources = [sources];
    }
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
    var options = {};
    options.format = format;

    if (format === 'json') {
        options.encode = function(value) {
            return JSON.stringify(value, null, '\t');
        };
        options.decode = function(value) {
            return JSON.parse(value);
        };
    }
    if (validationStrategy === 'mtime') {
        options.prevalidate = composeValidators(sources.map(function(source) {
            var debug = false;

            function ensureFileStat(path) {
                return fsAsync('stat', path).then(function(stat) {
                    if (stat.isFile()) {
                        return stat;
                    }
                    throw new Error(path + ' must be a file');
                });
            }

            return function(path) {
                return Promise.all([
                    ensureFileStat(path),
                    ensureFileStat(source)
                ]).then(function(stats) {
                    var storeStat = stats[0];
                    var sourceStat = stats[1];

                    if (storeStat.mtime >= sourceStat.mtime) {
                        if (debug) {
                            console.log(path, 'uptodate with', source);
                        }
                        return true;
                    }
                    if (debug) {
                        console.log(path, 'outdated against', source);
                    }
                    return false;
                });
            };
        }));
    } else if (validationStrategy === 'eTag') {
        if (format !== 'json') {
            throw new Error('eTag strategy only supported with JSON format');
        }

        options.wrap = function(value) {
            return Promise.all(
                sources.map(function(source) {
                    return getFileContentEtag(source);
                })
            ).then(function(eTags) {
                return {
                    sourceEtags: eTags,
                    value: value
                };
            });
        };
        options.postvalidate = composeValidators(sources.map(function(source, index) {
            var debug = false;

            return function(value) {
                return getFileContentEtag(source).then(function(sourceEtag) {
                    if (value.sourceEtags[index] === sourceEtag) {
                        if (debug) {
                            console.log('etag matching', path, source);
                        }
                        return true;
                    }
                    if (debug) {
                        console.log('etag mismatch between', path, 'and', source);
                    }
                    return false;
                });
            };
        }));
        options.unwrap = function(wrappedValue) {
            return wrappedValue.value;
        };
    }

    var store = fileStore(path, options);

    return memoizeAsync(fn, store);
}
function fileStore(path, customOptions) {
    var defaultOptions = {
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
        }
    };
    var options = {};
    /* eslint-disable guard-for-in */
    var key;
    for (key in defaultOptions) {
        options[key] = defaultOptions[key];
    }
    for (key in (customOptions || {})) {
        options[key] = customOptions[key];
    }

    var invalidEntry = {
        valid: false,
        value: undefined
    };
    function prevalidate() {
        var visible = (fs.constants || fs).F_OK;
        return fsAsync('access', path, visible).then(
            function() {
                return Promise.resolve(options.prevalidate(path)).then(function(preValidity) {
                    if (!preValidity) {
                        return Promise.reject(invalidEntry);
                    }
                });
            },
            function() {
                return Promise.reject(invalidEntry);
            }
        );
    }
    function postvalidate(value) {
        return Promise.resolve(options.postvalidate(value)).then(function(postValidity) {
            if (postValidity) {
                return value;
            }
            return Promise.reject(invalidEntry);
        });
    }

    var store = {
        read: function() {
            return prevalidate().then(function() {
                return fsAsync.getFileContent(path);
            }).then(
                options.decode
            ).then(
                postvalidate
            ).then(
                options.unwrap
            ).then(function(value) {
                return {
                    valid: true,
                    value: value
                };
            }).catch(function(value) {
                if (value === invalidEntry) {
                    return invalidEntry;
                }
                return Promise.reject(value);
            });
        },

        write: function(value) {
            return Promise.resolve(value).then(
                options.wrap
            ).then(
                options.encode
            ).then(function(value) {
                return fsAsync.setFileContent(path, value);
            });
        }
    };

    return store;
}

function getFileContentEtag(path) {
    return fsAsync.getFileContent(path).then(createEtag);
}

var crypto = require('crypto');
var base64PadCharRegExp = /\=+$/;
function createEtag(string) {
    if (string.length === 0) {
        // fast-path empty
        return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
    }

    var hash = crypto.createHash('sha1');
    hash.update(string, 'utf8');
    var result = hash.digest('base64');
    result = result.replace(base64PadCharRegExp, '');

    return '"' + string.length.toString(16) + '-' + result + '"';
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

module.exports = {
    file: memoizeUsingFile
};
