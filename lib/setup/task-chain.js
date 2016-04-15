import jsenv from 'jsenv';
import proto from 'jsenv/proto';

var Task = function() {
    if (arguments.length === 1) {
        this.populate(arguments[0]);
    } else if (arguments.length === 2) {
        this.name = arguments[0];
        this.populate(arguments[1]);
    }
};

Task.prototype = {
    dependencies: [], // should check that taks dependencies have been executed before executing this one
    name: undefined,
    skipped: false,
    disabled: false,
    ended: false,
    next: null,

    populate: function(properties) {
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

    skipIf: function(getSkipReason) {
        this.getSkipReason = getSkipReason;
        return this;
    },

    enable: function() {
        this.disabled = false;
    },

    disable: function() {
        this.disabled = true;
    },

    chain: function(task) {
        if (this.ended) {
            throw new Error(this.name + 'task is ended : cannot chain more task to it');
        }

        // features.debug('do', task.name, 'after', this.name);

        var next = this.next;
        if (next) {
            next.chain(task);
        } else {
            this.next = task;
        }

        return this;
    },

    insert: function(task, beforeTask) {
        if (beforeTask) {
            var next = this.next;
            if (!next) {
                throw new Error('cannot insert ' + task.name + ' before ' + beforeTask.name);
            }

            if (next === beforeTask) {
                this.next = null;

                this.chain(task);
                task.chain(next);
                return this;
            }
            return next.insert(task, beforeTask);
        }

        return this.chain(task);
    },

    skip: function(reason) {
        this.skipped = true;
        reason = reason || 'no specific reason';
        // features.debug('skip task', this.name, ':', reason);
    },

    locate: function() {
        var location;
        if (this.url) {
            location = jsenv.locate(this.url);
        } else {
            location = jsenv.locate(this.name);
        }
        return location;
    },

    locateHook: function() {
        return Promise.resolve(this.locate()).then(function(location) {
            this.location = location;
            return location;
        }.bind(this));
    },

    import: function() {
        return this.locateHook().then(function(location) {
            jsenv.debug('importing', location);
            return System.import(location);
        });
    },

    exec: function(value) {
        if (this.hasOwnProperty('fn') === false) {
            return this.import();
        }
        return this.fn(value);
    },

    before: function(value) {
        return value;
    },

    after: function(value) {
        return value;
    },

    start: function(value) {
        // features.info(features.type, features.location, features.baseURL);
        jsenv.task = this;
        jsenv.debug('start task', this.name);

        return Promise.resolve(value).then(
            this.before.bind(this)
        ).then(function(resolutionValue) {
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
        }.bind(this)).then(function(resolutionValue) {
            if (this.next) {
                // will throw but it will be ignored
                return this.next.start(value);
            }
            return resolutionValue;
        }.bind(this));
    }
};

var noop = function() {};
var headTask = new Task('head', noop);
var tailTask = new Task('tail', noop);

headTask.chain(tailTask);

var TaskChain = {
    head: headTask,
    tail: tailTask,

    get: function(taskName) {
        var task = this.head;

        while (task) {
            if (task.name === taskName) {
                break;
            } else {
                task = task.next;
            }
        }

        return task;
    },

    enable: function(taskName) {
        return this.get(taskName).enable();
    },

    disable: function(taskName) {
        return this.get(taskName).disabled();
    },

    add: function(task) {
        return this.head.chain(task);
    },

    insert: function(task, beforeTask) {
        return this.head.insert(task, beforeTask);
    },

    create: function() {
        var task = proto.create.apply(Task, arguments);
        return task;
    }
};

export default TaskChain;
