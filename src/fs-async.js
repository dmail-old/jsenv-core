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

module.exports = fsAsync;
