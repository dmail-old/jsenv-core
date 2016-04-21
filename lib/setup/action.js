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
            fn: 100,
            after: 5000
        })
    }),
    // before() {},
    // after() {},
    name: undefined,
    agent: {}, // any agent is ok, but you can provide {type: 'browser', name: 'firefox'}

    state: '', // 'resolved', 'rejected', ''
    pending: false,
    cancelled: false,
    skipped: false,
    expired: false,

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
                let timeoutDuration = timeouts[name];
                this.timeout = Timeout.create(this.expire, this, timeoutDuration);
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

    clean() {
        this.endDate = new Date();

        if (this.timeout) { // clean the timeout in case there is one and he is not over
            this.timeout.delete();
        }

        this.pending = false;
    },

    settle(value, resolved) {
        this.value = value;
        this.state = resolved ? 'resolved' : 'rejected';
    },

    cancel() {
        if (this.state !== '') {
            throw new Error('cancel() must not be called once lazyModule is settled');
        }

        this.cancelled = true;
    },

    skip(reason = 'no reason provided') {
        if (this.skipped) {
            throw new Error('skip() but already skipped');
        } else if (this.resolved || this.rejected) {
            throw new Error('skip() must not be called after task is done');
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

    exec() {
        this.startDate = new Date();

        var methods = [
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
            }
        ];

        var promise = pipe(methods, this, undefined, function() {
            return this.cancelled === true;
        }.bind(this));

        return Thenable.after(promise, function(value, resolved) {
            this.settle(value, resolved);
            this.clean();
        }, this);
    }
});

export default Action;
