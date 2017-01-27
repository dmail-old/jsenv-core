require('./index.js');
var jsenv = global.jsenv;

function findAsync(iterable, fn) {
    var i = -1;
    var j = iterable.length;
    function next() {
        i++;
        if (i === j) {
            return null;
        }

        var entry = iterable[i];
        return Promise.resolve(fn(entry, i, iterable)).then(function(value) {
            if (value) {
                return entry;
            }
            return next();
        });
    }

    if (j === 0) {
        return Promise.resolve(null);
    }
    return next();
}
function trace(node) {
    var nodes = [];
    var prevOrSelf = node;

    while (prevOrSelf) {
        nodes.unshift(prevOrSelf.branch.name);
        prevOrSelf = prevOrSelf.prev;
    }

    return nodes.join(',');
}

function compileNode(node) {
    console.log('branch order', trace(node));

    var branch = node.branch;
    var hasThrowed = false;
    var throwedValue;
    var returnValue;

    try {
        returnValue = branch.run(node);
    } catch (e) {
        hasThrowed = true;
        throwedValue = e;
    }

    var result;
    if (hasThrowed) {
        result = Promise.reject(throwedValue);
    } else if (returnValue && 'then' in returnValue && typeof returnValue.then === 'function') {
        result = returnValue;
    } else {
        result = Promise.resolve(returnValue);
    }

    return branch.handleResult(node, result);
}
function createBranch(properties) {
    var Branch = {
        constructor: function() {
            this.children = [];
        },
        max: 1,

        sequence: function() {

        },

        handleResolution: function(/* node, resolutionValue */) {

        },

        handleRejection: function(node, rejectionValue) {
            function getBranchTakenCount(branch) {
                var ancestorNodeOrSelf = node;
                var count = 0;
                while (ancestorNodeOrSelf && ancestorNodeOrSelf.branch === branch) {
                    count++;
                    ancestorNodeOrSelf = ancestorNodeOrSelf.prev;
                }
                return count;
            }

            var rejectionBranches = node.branch.children.filter(function(branch) {
                return branch.status === 'rejected';
            });

            return findAsync(rejectionBranches, function(branch) {
                var max = branch.max;
                if (max > -1) {
                    var count = getBranchTakenCount(branch);
                    if (count >= max) {
                        return false;
                    }
                }
                return branch.when(rejectionValue);
            }).then(function(branch) {
                if (branch) {
                    var nextNode = branch.nextNode(node, rejectionValue);
                    if (nextNode) {
                        node.next = nextNode;
                        nextNode.prev = node;
                        return compileNode(nextNode);
                    }
                }
                return Promise.reject(rejectionValue);
            });
        },

        handleResult: function(node, result) {
            return result.then(
                function(value) {
                    return this.handleResolution(node, value);
                }.bind(this),
                function(value) {
                    return this.handleRejection(node, value);
                }.bind(this)
            );
        },

        rejectionRetry: function(name, descriptor) {
            var after;
            if ('after' in descriptor) {
                var descriptorAfter = descriptor.after;
                if (typeof descriptorAfter === 'number') {
                    after = descriptorAfter;
                    if (after < 0) {
                        after = undefined;
                    }
                } else if (typeof descriptorAfter === 'function') {
                    after = descriptorAfter;
                } else {
                    throw new TypeError('after must be a number or a function');
                }
            }

            var max;
            if ('max' in descriptor) {
                var descriptorMax = descriptor.max;
                if (typeof descriptorMax === 'number') {
                    max = descriptorMax;
                    if (max === 0) {
                        throw new Error('max must not be 0');
                    }
                } else {
                    throw new TypeError('max must a a number');
                }
            } else {
                max = 1;
            }

            var rejectionRetryBranch = createBranch({
                name: name,
                status: 'rejected',
                max: max,
                when: descriptor.when,
                transform: descriptor.transform
            });

            if (typeof after === 'number') {
                rejectionRetryBranch.nextNode = function(node) {
                    var dynamicSetTimeoutBranch = createBranch({
                        name: node.branch.name + '-timeout:' + after,
                        sequence: function(after) {
                            return new Promise(function(resolve) {
                                setTimeout(resolve, after);
                            });
                        },
                        nextNode: function() {
                            console.log('calling', node.branch.sequence.toString(), 'with', node.args);

                            return null;
                            // return {
                            //     branch: node.branch,
                            //     bind: node.bind,
                            //     args: this.transform(node.args)
                            // };
                        }
                    });
                    // il faudrais que peu omporte si ça se résoud ou si ça échoue
                    // enfin si ça se résout plutôt alors on reprend où on en était
                    // autrement dit réutiliser les enfant mais surtout pas celui-ci si?
                    dynamicSetTimeoutBranch.children = node.branch.children;

                    // handleResult est responsable de produire le prochain résultat
                    // donc en gros il doit reprendre où il en était
                    // var oldHandleResult = dynamicSetTimeoutBranch.handleResult;
                    dynamicSetTimeoutBranch.handleResult = function(dynamicNode) {
                        // dynamicSetTimeoutBranch.handleResult = oldHandleResult;

                        var nextNode = this.nextNode(dynamicNode);
                        if (nextNode) {
                            nextNode.prev = dynamicNode;
                            dynamicNode.next = nextNode;

                            return compileNode(nextNode);
                        }
                        return undefined;
                    };

                    return {
                        branch: dynamicSetTimeoutBranch,
                        bind: null,
                        args: [after]
                    };
                };
            } else if (typeof after === 'function') {
                rejectionRetryBranch.nextNode = function(node) {
                    var dynamicAfterBranch = createBranch({
                        name: node.branch.name + '-after',
                        sequence: after,
                        nextNode: function() {
                            console.log('calling', node.branch.sequence.toString(), 'with', node.args);
                            return {
                                branch: node.branch,
                                bind: node.bind,
                                args: this.transform(node.args)
                            };
                        }
                    });

                    return {
                        branch: dynamicAfterBranch,
                        bind: node.bind,
                        args: node.args
                    };
                };
            } else {
                rejectionRetryBranch.handleResult = function(node) {
                    var prev = node.prev;
                    console.log('retrying', prev.branch.name, 'with', this.transform(prev.args));
                    var nextNode = createNode({
                        branch: prev.branch,
                        bind: prev.bind,
                        args: this.transform(prev.args)
                    });
                    node.next = nextNode;
                    nextNode.prev = node;
                    return compileNode(nextNode);
                };
            }

            this.children.push(rejectionRetryBranch);
            return rejectionRetryBranch;
        },

        run: function(node) {
            return this.sequence.apply(node.bind, node.args);
        },

        nextNode: function(value) {
            return createNode({
                branch: this,
                bind: this,
                args: [value]
            });
        },

        transform: function(args) {
            return args;
        },

        rejectionRecovery: function(name, descriptor) {
            var rejectionRecoveryBranch = createBranch({
                name: name,
                status: 'rejected',
                when: descriptor.when,
                sequence: function() {
                    // nothing to do
                }
            });
            this.children.push(rejectionRecoveryBranch);
            return rejectionRecoveryBranch;
        },

        reuse: function(branchName, source) {
            var sourceBranch = source.branch(branchName);
            if (!sourceBranch) {
                throw new Error('cannot find branch ' + branchName);
            }
            this.children.push(sourceBranch);
            return sourceBranch;
        },

        branch: function(branchName) {
            return this.children.find(function(branch) {
                return branch.name === branchName;
            });
        },

        exec: function(bind, args) {
            var firstNode = createNode({
                branch: this,
                bind: bind,
                args: args
            });

            return compileNode(firstNode);
        }
    };

    var branch = jsenv.assign(Branch, properties);
    branch.constructor();
    return branch;
}
function createNode(properties) {
    var Node = {
        insert: function() {

        }
    };
    var node = jsenv.assign(Node, properties);

    return node;
}
function sourceAsync(fn) {
    var rootBranch = createBranch({
        name: fn.name,
        sequence: fn,
        max: -1
    });

    var exec = function() {
        return rootBranch.exec(this, arguments);
    };
    [
        'rejectionRetry',
        'rejectionRecovery',
        'reuse'
    ].forEach(function(name) {
        exec[name] = rootBranch[name].bind(rootBranch);
    });

    return exec;
}

var test = sourceAsync(function rejectAll(value) {
    return Promise.reject(value);
});

test.rejectionRecovery('foo', {
    when: function(error) {
        return error === 'foo';
    }
});
test.rejectionRetry('baz', {
    when: function(error) {
        return error === 'baz';
    },
    transform: function() {
        return ['foo'];
    }
});
test.rejectionRetry('delayed', {
    when: function(error) {
        return error === 'delayed';
    },
    after: 500
});
test.rejectionRetry('after', {
    when: function(error) {
        return error === 'after';
    },
    after: function() {
        return new Promise(function(resolve) {
            setTimeout(resolve, 800);
        });
    }
});

// test('foo').then(
//     function(value) {
//         console.log('resolve foo', value);
//     },
//     function(value) {
//         console.log('reject foo', value);
//     }
// );
// test('bar').then(
//     function(value) {
//         console.log('resolve bar', value);
//     },
//     function(value) {
//         console.log('reject bar', value);
//     }
// );
test('baz').then(
    function(value) {
        console.log('resolve baz', value);
    },
    function(value) {
        console.log('reject baz', value);
    }
);
// test('delayed').then(
//     function(value) {
//         console.log('delayed resolved to', value);
//     },
//     function(value) {
//         console.log('delayed rejected to', value);
//     }
// );
// test('after').then(
//     function(value) {
//         console.log('after resolved to', value);
//     },
//     function(value) {
//         console.log('after rejected to', value);
//     }
// );

// function createExecutorCallback(resolve, reject) {
//     return function(error, result) {
//         if (error) {
//             reject(error);
//         } else {
//             resolve(result);
//         }
//     };
// }
// function callback(fn, bind) {
//     var args = Array.prototype.slice.call(arguments, 2);

//     return new Promise(function(resolve, reject) {
//         args.push(createExecutorCallback(resolve, reject));
//         fn.apply(bind, args);
//     });
// }
// function createFolder(path) {
//     var mkdir = sourceAsync(function(path) {
//         return callback(fs.mkdir, fs, path);
//     });

//     mkdir.rejectionRetry('overflow', {
//         when: function(error) {
//             return error.code === 'EMFILE';
//         },
//         after: 100,
//         max: 3
//     });
//     mkdir.rejectionRetry('busy', {
//         when: function(error) {
//             return error.code === 'EBUSY';
//         },
//         after: 1,
//         max: 1000
//     });
//     mkdir.rejectionRetry('permission', {
//         when: function(error) {
//             return error.code === 'EPERM' && jsenv.isWindows();
//         },
//         after: function(path) {
//             return callback(fs.chmod, path, 666);
//         }
//     });
//     mkdir.rejectionRetry('exist', {
//         when: function(error) {
//             return error.code === 'EXIST';
//         },
//         after: function(path) {
//             var unlink = source(function() {
//                 return callback(fs.unlink, fs, path);
//             });

//             unlink.reuse(mkdir.branch('permission'));
//             unlink.reuse(mkdir.branch('busy'));
//             unlink.reuse(mkdir.branch('permission'));

//             unlink.rejectionRecovery('notfound', {
//                 when: function(error) {
//                     return error.code === 'ENOENT';
//                 }
//             });
//             unlink.rejectionRecovery('directory', {
//                 when: function(error) {
//                     return error.code === 'EISDIR';
//                 }
//             });
//         }
//     });

//     return mkdir(path);
// }
// function setFileContent(path, content) {
//     var write = sourceAsync(function(path, content) {
//         return callback(fs.write, path, content);
//     });

//     write.rejectionRetry('overflow', {
//         when: function(error) {
//             return error.code === 'EMFILE';
//         },
//         after: 100,
//         max: 3
//     });
//     write.rejectionRetry('busy', {
//         when: function(error) {
//             return error.code === 'EBUSY';
//         },
//         after: 1,
//         max: 1000
//     });
//     write.rejectionRetry('permission', {
//         when: function(error) {
//             return error.code === 'EPERM' && jsenv.isWindows();
//         },
//         after: function() {
//             return callback(fs.chmod, path, 666);
//         }
//     });
//     write.rejectionRetry('directory', {
//         when: function(error) {
//             return error.code === 'EISDIR';
//         },
//         after: function(path) {
//             var removeFolder = source(function() {
//                 return callback(fs.rmdir, fs, path);
//             });

//             removeFolder.reuse('overflow', write);
//             removeFolder.reuse('busy', write);
//             removeFolder.rejectionRecovery('notfound', {
//                 when: function(error) {
//                     return error.code === 'ENOENT';
//                 }
//             });
//             removeFolder.rejectionRetry('notempty', {
//                 when: function(error) {
//                     return error.code === 'ENOTEMPTY' || error.code === 'EEXIST' || error.code === 'EPERM';
//                 },
//                 after: function(path) {
//                     return callback(fs.readdir, path).then(function(names) {
//                         var paths = names.map(function(name) {
//                             return path + '/' + name;
//                         });
//                         var removeRessourcePromises = paths.map(function(ressourcePath) {
//                             var removeRessource = source(function(path) {
//                                 return callback(fs.unlink, fs, path);
//                             });

//                             removeRessource.reuse('overflow', removeFolder);
//                             removeRessource.reuse('busy', removeFolder);
//                             removeRessource.reuse('notfound', removeFolder);
//                             removeRessource.reuse('permission', write);
//                             removeRessource.reuse('directory', write);

//                             return removeRessource(ressourcePath);
//                         });
//                         return Promise.all(removeRessourcePromises);
//                     });
//                 }
//             });

//             return removeFolder();
//         }
//     });

//     return write(path, content);
// }

// export {createFolder};
// export {setFileContent};
