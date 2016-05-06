import jsenv from 'jsenv';
import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import Timeout from 'jsenv/timeout';
import Thenable from 'jsenv/thenable';
import Iterable from 'jsenv/iterable';
import LazyModule from 'jsenv/lazy-module';

function pipe(methods, bind, initialValue, condition) {
    var iterableMethods = Iterable.map(methods, function(method, index, methods, value) {
        return Thenable.callFunction(method, bind, value);
    }, bind);

    return Iterable.reduceToThenable(iterableMethods, initialValue, condition);
}

let Action = proto.extend('Action', {
    options: Options.create({
        timeouts: Options.create({
            before: 5000,
            main: -1,
            after: 5000,
            beforeAll: 5000,
            beforeEach: 100,
            afterEach: 100,
            afterAll: 5000
        })
    }),
    // before() {},
    // after() {},
    // beforeEach() {},
    // afterEach() {},
    // beforeAll() {},
    // afterAll() {},
    name: undefined,
    agent: {}, // any agent is ok, but you can provide {type: 'browser', name: 'firefox'}
    state: 'idle', // idle, setup, config, main, run, done
    configActions: [], // dependencies
    runActions: [], // dependents
    current: undefined,

    startDate: undefined,
    endDate: undefined,
    value: undefined,
    result: undefined,
    pending: false,
    cancelled: false,
    skipped: false,
    expired: false,
    settled: false,
    resolved: false,
    rejected: false,

    constructor() {
        if (arguments.length === 0) {
            throw new TypeError('missing action first argument');
        }
        if (Action.isPrototypeOf(arguments[0])) {
            return arguments[0];
        }

        this.configActions = [];
        this.runActions = [];

        if (arguments.length === 1) {
            this.populate(arguments[0]);
        } else if (arguments.length === 2) {
            this.name = arguments[0];
            this.populate(arguments[1]);
        }
    },

    get(list, name, preventError) {
        var found = list.find(function(action) {
            return action.name === name;
        });
        if (!preventError && !found) {
            throw new Error('no action named ' + name);
        }
        return found;
    },

    getConfig(name, preventError) {
        return this.get(this.configActions, name, preventError);
    },

    getRun(name, preventError) {
        return this.get(this.runActions, name, preventError);
    },

    make(...args) {
        return this[Symbol.species]().create(...args);
    },

    register(list, action) {
        let name = action.name;

        if (name && this.get(list, name, true)) {
            throw new Error('action conflict : there is already an action named ' + name);
        }

        list.push(action);

        return action;
    },

    config(...args) {
        if (this.state !== 'idle' && this.state !== 'setup' && this.state !== 'config') {
            throw new Error('config() must be called during idle, setup or config');
        }

        var action = this.make(...args);

        // console.log('add config', action.name, 'for', this.name, arguments.length);

        return this.register(this.configActions, action);
    },

    run(...args) {
        // we could run the action immedtaly but for now we throw
        if (this.state === 'done') {
            throw new Error('run() cannot be called once action is done');
        }

        var action = this.make(...args);

        action.parent = this;
        action.options = Options.create(this.options);

        return this.register(this.runActions, action);
    },

    createMainHook(data) {
        if (typeof data === 'function') {
            return data;
        } else if (typeof data === 'string') {
            var lazyModule = LazyModule.create();
            lazyModule.location = data;
            var main = function() {
                return lazyModule.import();
            };
            main.lazyModule = lazyModule;
            return main;
        }
        throw new TypeError('createRunHook expect string or function');
    },

    populate(properties) {
        if (typeof properties === 'object') {
            Object.assign(this, properties);
        } else {
            this.main = this.createMainHook(properties);
            if (!this.name) {
                this.name = this.main.name;
            }
        }

        if (typeof this.main !== 'function') {
            throw new Error('action must have a main function');
        }
    },

    getHookArguments() {
        return this.configActions.map(function(configAction) {
            return configAction.result;
        });
    },

    createHookPromise(name) {
        return Thenable.applyFunction(this[name], this, this.getHookArguments(name));
    },

    createTimeout(name) {
        let timeouts = this.options.timeouts;
        let timeout = Timeout.create();

        if (name in timeouts) {
            timeout.set(timeouts[name]);
        }

        return timeout;
    },

    callHook(name) {
        let hookPromise;

        if (name in this && typeof this[name] === 'function') {
            hookPromise = this.createHookPromise(name);

            this.timeout = this.createTimeout(name);
            this.timeout.turnExpirationIntoRejection();

            Thenable.after(hookPromise, this.timeout.delete, this.timeout);
            hookPromise = Promise.race([
                hookPromise,
                this.timeout
            ]);

            hookPromise = hookPromise.catch(function(value) {
                var error;

                if (value instanceof Error) {
                    error = value;
                } else if (Timeout.isPrototypeOf(value)) {
                    error = new Error(name + ' hook timed out after ' + value.value);
                } else {
                    error = new Error(name + ' hook was rejected with ' + value);
                }

                return Promise.reject(error);
            });
        } else {
            hookPromise = Promise.resolve();
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
            this.forceReject(new Error(this.name + ' timedout after ' + this.timeout.value));
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

        if (this.timeout) { // clean the timeout in case there is one and he is not over
            this.timeout.delete();
        }

        return this.transform();
    },

    cancel(reason = 'no cancel reason specified') {
        if (this.settled) {
            throw new Error('cancel(' + reason + ') must not be called once action is settled');
        }

        this.cancelReason = reason;
        this.cancelled = true;
        jsenv.debug(this.name, 'cancelled because:', reason);

        if (this.timeout) { // clean the timeout in case there is one and he is not over
            this.timeout.delete();
        }
    },

    skip(reason = 'skipped') {
        if (this.skipped) {
            throw new Error('skip() but already skipped');
        } else if (this.settled) {
            throw new Error('skip() must not be called after action is settled');
        }

        this.skipped = true;
        this.cancel(reason);
    },

    unskip() {
        if (this.pending) {
            throw new Error('unskip() must not be called while action is pending');
        }
        if (this.settled) {
            throw new Error('unskip() must not be called after action is settled');
        }

        this.cancelled = false;
        this.skipped = false;
        this.cancelReason = undefined;
    },

    resolve(value) {
        this.settle(value, true);
        this.cancel('resolved');
    },

    reject(value) {
        this.settle(value, false);
        this.cancel('rejected');
    },

    expire() {
        this.expired = true;
        this.cancel('expired');
    },

    startEffect() {
        this.startDate = new Date();
        this.pending = true;
    },

    endEffect() {
        this.endDate = new Date();
        this.pending = false;
    },

    execActionList(list) {
        var promises = Iterable.map(list, function(action) {
            this.current = action;
            return action.exec();
        }, this);
        return Iterable.reduceToThenable(promises);
    },

    createConfigPromise() {
        return this.execActionList(this.configActions);
    },

    createMainPromise() {
        var parent = this.parent;

        var mainPromise = pipe([
            function() {
                return this.callHook('before');
            },
            function() {
                return parent ? parent.callHook('beforeEach') : undefined;
            },
            function() {
                jsenv.debug('exec', this.name);
                return this.callHook('main');
            }
        ], this);

        return Thenable.after(mainPromise, function() {
            var afterPromise = this.callHook('after');

            if (parent) {
                afterPromise = Promise.all([
                    afterPromise,
                    parent.callHook('afterEach')
                ]);
            }

            return afterPromise;
        }, this);
    },

    createRunPromise() {
        var runPromise = pipe([
            function() {
                return this.callHook('beforeAll');
            },
            function() {
                return this.execActionList(this.runActions);
            }
        ], this);

        return Thenable.after(runPromise, function() {
            return this.callHook('afterAll');
        }, this);
    },

    listOperations() {
        return [
            function() {
                this.state = 'setup';
                return this.startEffect();
            },
            function() {
                var skipReason = this.getSkipReason();
                if (skipReason) {
                    this.skip(skipReason);
                }
            },
            function() {
                this.state = 'config';
                return this.createConfigPromise();
            },
            function() {
                this.state = 'main';
                return this.createMainPromise();
            },
            function(value) {
                this.result = value;
                this.state = 'run';
                return this.createRunPromise();
            },
            function() {
                this.state = 'done';
                return this.endEffect();
            }
        ];
    },

    reset() {
        this.state = 'idle';
        this.pending = this.cancelled = this.skipped = this.expired = this.settled =
        this.resolved = this.rejected = false;
        this.startDate = this.endDate = this.result = this.value = undefined;
        // this.configActions.length = this.runActions.length = 0;
    },

    exec() {
        if (this.state !== 'idle') {
            this.reset();
        }
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
