import jsenv from 'jsenv';
import proto from 'jsenv/proto';
// import Options from 'jsenv/options';
import Timeout from 'jsenv/timeout';
import Thenable from 'jsenv/thenable';
import Iterable from 'jsenv/iterable';

/*

It's VERY similar to test object used for unit testing so Test will extend Task
cause we need same functionalities : modules, skip, agents, etc

*/

let Task = proto.extend('Task', {
    modules: [],
    name: undefined,
    skipped: false,

    constructor() {
        if (arguments.length === 1) {
            this.populate(arguments[0]);
        } else if (arguments.length === 2) {
            this.name = arguments[0];
            this.populate(arguments[1]);
        }
    },

    populate(properties) {
        if (typeof properties === 'object') {
            for (var key in properties) { // eslint-disable-line
                this[key] = properties[key];
            }
        } else if (typeof properties === 'function') {
            this.fn = properties;
            if (this.hasOwnProperty('name') === false) {
                this.name = this.fn.name;
            }
        } else if (typeof properties === 'string') {
            this.url = properties;
            if (this.hasOwnProperty('name') === false) {
                this.name = properties;
            }
        }
    },

    skipIf(getSkipReason) {
        this.getSkipReason = getSkipReason;
        return this;
    },

    skip(reason) {
        this.skipped = true;
        reason = reason || 'no specific reason';
        // features.debug('skip task', this.name, ':', reason);
    },

    locate() {
        var location;
        if (this.url) {
            location = jsenv.locate(this.url);
        } else {
            location = jsenv.locate(this.name);
        }
        return location;
    },

    locateHook() {
        return Promise.resolve(this.locate()).then(function(location) {
            this.location = location;
            return location;
        }.bind(this));
    },

    import() {
        return this.locateHook().then(function(location) {
            jsenv.debug('importing', location);
            return System.import(location);
        });
    },

    exec(value) {
        if (this.hasOwnProperty('fn') === false) {
            return this.import();
        }
        return this.fn(value);
    },

    before(value) {
        return value;
    },

    after(value) {
        return value;
    },

    isNodeModule(moduleName) {
        return moduleName.indexOf('@node/') === 0;
    },

    shouldExportDefault(exports, module) {
        if (('default' in exports) === false) {
            return false;
        }
        if (this.isNodeModule(module)) {
            return true;
        }
        return false;
    },

    hasNodeModuleImport() {
        return this.modules.some(this.isNodeModule, this);
    },

    loadModules() {
        var moduleImportPromises = this.modules.map(function(module) {
            return System.import(module, this.url).then(function(exports) {
                if (this.shouldExportDefault(exports, module)) {
                    return exports.default;
                }
                return exports;
            }.bind(this));
        }, this);

        return Promise.all(moduleImportPromises).then(function(modules) {
            this.modules = modules;
        }.bind(this));
    },

    callHook(name) {
        let hookPromise;

        if (name in this) {
            let method = this[name];

            hookPromise = Thenable.applyFunction(method, this, this.modules).catch(function(value) {
                if (value instanceof Error) {
                    return Promise.reject(value);
                }
                var error = new Error(name + ' hook was rejected with ' + value);
                return Promise.reject(error);
            });

            let timeouts = this.options.timeouts;
            if (name in timeouts) {
                this.timeout = Timeout.create(this.expire, this, timeouts[name]);
                hookPromise = Thenable.after(hookPromise, function() {
                    this.timeout.delete(); // timeout useless when hook is settled
                }, this);
            }
        }

        return hookPromise;
    },

    start(value) {
        return Thenable.callFunction(this.before, this, value).then(function(resolutionValue) {
            if (this.disabled) {
                this.skip('disabled');
            } else if (this.hasOwnProperty('getSkipReason')) {
                var skipReason = this.getSkipReason();
                if (skipReason) {
                    this.skip(skipReason);
                }
            }

            if (this.skipped) {
                return resolutionValue;
            }
            return this.exec(resolutionValue);
        }.bind(this)).then(function(resolutionValue) {
            this.ended = true;
            return this.after(resolutionValue);
        }.bind(this));
    }
});

let TaskChain = proto.extend('TaskChain', {
    constructor() {
        this.tasks = [];
    },

    get(taskName) {
        return this.tasks.find(function(task) {
            return task.name === taskName;
        });
    },

    enable(taskName) {
        return this.get(taskName).unskip();
    },

    disable(taskName) {
        return this.get(taskName).skip('disable');
    },

    add(task) {
        this.tasks.push(task);
        return task;
    },

    insert(task, beforeTask) {
        if (beforeTask.ended) {
            throw new Error(beforeTask.name + 'task is ended : cannot insert task before it');
        }

        var index = this.tasks.indexOf(beforeTask);
        if (index === -1) {
            throw new Error('cannot insert' + task + ' before: not in the task chain');
        }
        this.tasks.splice(index, 0, task);
        return task;
    },

    createTask(...args) {
        return Task.create(...args);
    },

    start() {
        var iterableTaskPromise = Iterable.map(this.tasks, function(task) {
            this.task = task;
            jsenv.debug('start task', task.name);

            return task.start();
        }, this);

        return Iterable.reduceToThenable(iterableTaskPromise);
    }
});

export default TaskChain;
