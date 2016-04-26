import jsenv from 'jsenv';
import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import Timeout from 'jsenv/timeout';
import Thenable from 'jsenv/thenable';
import Iterable from 'jsenv/iterable';

function pipe(methods, bind, initialValue, condition) {
    var iterableMethods = Iterable.map(methods, function(method) {
        return Thenable.callFunction(method, bind);
    }, bind);

    return Iterable.reduceToThenable(iterableMethods, initialValue, condition);
}

let Action = proto.extend('Action', {
    options: Options.create({
        timeouts: Options.create({
            before: 5000,
            fn: -1,
            after: 5000
        })
    }),
    // before() {},
    // after() {},
    name: undefined,
    agent: {}, // any agent is ok, but you can provide {type: 'browser', name: 'firefox'}

    value: undefined,
    pending: false,
    cancelled: false,
    skipped: false,
    expired: false,
    settled: false,
    resolved: false,
    rejected: false,

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
            Object.assign(this, properties);
        } else if (typeof properties === 'function') {
            this.fn = properties;
        } else {
            throw new TypeError('populate expect object or function');
        }
    },

    getHookArguments() {
        return [];
    },

    createHookPromise(name) {
        return Thenable.applyFunction(this[name], this, this.getHookArguments(name));
    },

    callHook(name) {
        let hookPromise;

        if (name in this) {
            hookPromise = this.createHookPromise(name).catch(function(value) {
                if (value instanceof Error) {
                    return Promise.reject(value);
                }
                var error = new Error(name + ' hook was rejected with ' + value);
                return Promise.reject(error);
            });

            let timeouts = this.options.timeouts;
            if (name in timeouts) {
                let timeoutDuration = timeouts[name];
                this.timeout = Timeout.create(this.expire, this, timeoutDuration);
                this.timeout.hookName = name;
            }
        }

        return hookPromise;
    },

    getSkipReason() {
        let skipReason;
        let engineAgent = jsenv.agent;
        let expectedAgent = this.agent;
        let canRunOnAgent = engineAgent.match(expectedAgent);

        if (canRunOnAgent === false) {
            skipReason = 'unsupported agent : ' + engineAgent + ' (expecting' + JSON.stringify(expectedAgent) + ')';
        }

        return skipReason;
    },

    get duration() {
        return this.endDate ? this.endDate - this.startDate : 0;
    },

    forceValue(value) {
        if (this.value instanceof Error) {
            // dont touch the value we would lose error stack trace
            this.value.message += '\n' + value;
        } else {
            this.value = value;
        }
    },

    forceResolve(value) {
        this.resolved = true;
        this.rejected = false;
        if (arguments.length > 0) {
            this.forceValue(value);
        }
    },

    forceReject(value) {
        this.resolved = false;
        this.rejected = true;
        if (arguments.length > 0) {
            this.forceValue(value);
        }
    },

    transform() {
        // last chance to transform the action result now we know what hapenned
        if (this.expired) {
            this.forceReject(new Error('hook ' + this.timeout.hookName + ' timedout after ' + this.timeout.value));
        }
    },

    settle(value, resolved) {
        this.value = value;
        this.settled = true;
        if (resolved) {
            this.resolved = true;
        } else {
            this.rejected = true;
        }

        return this.transform();
    },

    unksip() {
        if (this.skipped) {
            if (this.pending) {
                throw new Error('unksip() must not be called when action is pending');
            }
            if (this.settled) {
                throw new Error('unksip() must not be called when action is settled');
            }

            this.skipped = false;
            this.cancelled = false;
        }
    },

    cancel() {
        if (this.settled) {
            throw new Error('cancel() must not be called once lazyModule is settled');
        }

        this.cancelled = true;
    },

    skip(reason = 'no reason provided') {
        if (this.skipped) {
            throw new Error('skip() but already skipped');
        } else if (this.settled) {
            throw new Error('skip() must not be called after task is settled');
        }

        if (arguments.length > 0) {
            this.skipReason = reason;
        }

        this.skipped = true;
        this.cancel();
    },

    resolve(value) {
        this.settle(value, true);
        this.cancel();
    },

    reject(value) {
        this.settle(value, false);
        this.cancel();
    },

    expire() {
        this.expired = true;
        this.cancel();
    },

    startEffect() {
        this.startDate = new Date();
        this.pending = true;
    },

    endEffect() {
        this.endDate = new Date();
        this.pending = false;

        if (this.timeout) { // clean the timeout in case there is one and he is not over
            this.timeout.delete();
        }
    },

    listOperations() {
        return [
            function() {
                return this.startEffect();
            },
            function() {
                var skipReason = this.getSkipReason();
                if (skipReason) {
                    this.skip(skipReason);
                }
            },
            function() {
                return this.callHook('before');
            },
            function() {
                return this.callHook('fn');
            },
            function() {
                return this.callHook('after');
            },
            function() {
                return this.endEffect();
            }
        ];
    },

    exec() {
        var methods = this.listOperations();
        var promise = pipe(methods, this, undefined, function() {
            return this.cancelled === true;
        }.bind(this));

        var self = this;
        return new Promise(function(resolve, reject) {
            Thenable.after(promise, function(value, resolved) {
                return self.settle(value, resolved);
            }).then(function() {
                if (self.resolved) {
                    resolve(self.value);
                } else {
                    reject(self.value);
                }
            });
        });
    }
});

export default Action;
