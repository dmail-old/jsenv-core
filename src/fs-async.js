function createExecutorCallback(resolve, reject) {
    return function(error, result) {
        if (error) {
            reject(error);
        } else {
            resolve(result);
        }
    };
}
function callback(fn, bind) {
    var args = Array.prototype.slice.call(arguments, 2);

    return new Promise(function(resolve, reject) {
        args.push(createExecutorCallback(resolve, reject));
        fn.apply(bind, args);
    });
}

var fs = require('fs');
function fsAsync(methodName) {
    var args = [];

    args.push(fs[methodName], fs);
    var i = 1;
    var j = arguments.length;
    while (i < j) {
        args.push(arguments[i]);
        i++;
    }
    return callback.apply(null, args);
}

function getFileLStat(path) {
    return callback(fs.lstat, fs, path);
}
function getFileContent(path, defaultContent) {
    if (arguments.length === 0) {
        throw new Error('missing arg to createFile');
    }
    var hasDefaultContent = arguments.length > 1;

    return callback(fs.readFile, fs, path).then(
        function(buffer) {
            var content = String(buffer);
            return content;
        },
        function(e) {
            if (e.code === 'ENOENT') {
                if (hasDefaultContent) {
                    return setFileContent(path, defaultContent);
                }
            }
            return Promise.reject(e);
        }
    );
}
function createFolder(path) {
    return callback(fs.mkdir, fs, path).catch(function(error) {
        // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
        if (error.code === 'EEXIST') {
            // vérifie que c'est bien un dossier
            return getFileLStat(path).then(function(stat) {
                if (stat) {
                    if (stat.isDirectory()) {
                        return;
                    }
                    // console.log('there is a file at', path);
                    throw error;
                }
            });
        }
        return Promise.reject(error);
    });
}
function createFoldersTo(path) {
    var folders = path.replace(/\\/g, '/').split('/');

    folders.pop();

    return folders.reduce(function(previous, directory, index) {
        var folderPath = folders.slice(0, index + 1).join('/');

        return previous.then(function() {
            return createFolder(folderPath);
        });
    }, Promise.resolve());
}
function setFileContent(path, content) {
    return createFoldersTo(path).then(function() {
        return callback(fs.writeFile, fs, path, content);
    }).then(function() {
        return content;
    });
}

fsAsync.getFileContent = getFileContent;
fsAsync.setFileContent = setFileContent;
fsAsync.createFolder = createFolder;

function getFileMtime(path) {
    return ensureFileStat(path).then(function(stat) {
        return stat.mtime;
    });
}
function ensureFileStat(path) {
    return fsAsync('stat', path).then(function(stat) {
        if (stat.isFile()) {
            return stat;
        }
        throw new Error(path + ' must be a file');
    });
}
fsAsync.getFileMtime = getFileMtime;

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
fsAsync.getFileContentEtag = getFileContentEtag;

module.exports = fsAsync;
