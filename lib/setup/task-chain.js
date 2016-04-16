import jsenv from 'jsenv';
import proto from 'jsenv/proto';
import Thenable from 'jsenv/thenable';
import Iterable from 'jsenv/iterable';

let Task = proto.extend('Task', {
    dependencies: [], // should check that taks dependencies have been executed before executing this one
    name: undefined,
    skipped: false,
    disabled: false,
    ended: false,

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

    enable() {
        this.disabled = false;
    },

    disable() {
        this.disabled = true;
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
        return this.get(taskName).enable();
    },

    disable(taskName) {
        return this.get(taskName).disabled();
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
