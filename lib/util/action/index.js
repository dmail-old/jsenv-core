import env from 'env';
import proto from 'env/proto';
import Options from 'env/options';
import Timeout from 'env/timeout';
import Thenable from 'env/thenable';
import Iterable from 'env/iterable';
import LazyModule from 'env/lazy-module';

function pipe(methods, bind, initialValue, condition) {
    var iterableMethods = Iterable.map(methods, function(method, index, methods, value) {
        return Thenable.callFunction(method, bind, value);
    }, bind);

    return Iterable.reduceToThenable(iterableMethods, initialValue, condition);
}

/*
Hook is a wrapper for a thenable allowing to collect the resolved/rejected value
Hook is itself a thenable that will resolve or reject to the hook itself
Moreover hook comes with an optional timeout mecanism
*/
let Hook = proto.extend('Hook', {
    constructor(thenable) {
        this.promise = new Promise(function(resolve, reject) {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;
        }.bind(this));

        thenable.then(this.resolve.bind(this), this.reject.bind(this));

        return this.promise;
    },

    setTimeout(duration) {
        this.timeout = Timeout.create();
        this.timeout.set(duration);
        this.timeout.then(function() {
            this.expire(this.timeout.value);
        }.bind(this));
    },

    clearTimeout() {
        if (this.timeout) {
            this.timeout.clear();
        }
    },

    clear() {
        this.clearTimeout();
    },

    expire(duration) {
        this.expired = true;
        this.reject(duration);
    },

    resolve(value) {
        this.clear();
        this.value = value;
        this.state = 'resolved';
        this.resolvePromise(value);
    },

    reject(value) {
        this.clear();
        this.value = value;
        this.state = 'rejected';
        this.rejectPromise(value);
    }
});

let ActionHook = Hook.extend('ActionHook', {
    constructor(action, name) {
        // jsenv.debug('create hook', name, 'for', action.name);

        this.action = action;
        this.name = name;
        let callback = this.getCallback();
        let thenable;
        if (callback) {
            thenable = Thenable.applyFunction(callback, action, this.getArguments());
        } else {
            thenable = Promise.resolve();
        }

        var promise = Hook.constructor.call(this, thenable);

        action.currentHook = this;
        if (callback) {
            let timeouts = action.options.timeouts;
            if (name in timeouts) {
                this.setTimeout(timeouts[name]);
            }
        }

        return promise;
    },

    getCallback() {
        var name = this.name;
        var action = this.action;
        var callback;

        if (name in action) {
            let value = action[name];
            if (typeof value === 'function') {
                callback = value;
            }
        }

        return callback;
    },

    getArguments() {
        return this.action.configActions.map(function(configAction) {
            return configAction.result;
        });
    },

    reject(value) {
        if (value instanceof Error) {
            value.message = this.name + ' hook error: ' + value.message;
        } else if (this.expired) {
            if (typeof value === 'number') {
                value = this.name + ' hook timed out after ' + value;
            } else {
                value = this.name + ' hook expired';
            }
        } else {
            value = this.name + ' hook rejected with ' + value;
        }

        return Hook.reject.call(this, value);
    },

    clear() {
        this.action.currentHook = undefined;
        return Hook.clear.call(this);
    }
});

let Action = proto.extend('Action', {
    options: {
        timeouts: {
            before: 5000,
            main: -1,
            after: 5000,
            beforeAll: 5000,
            beforeEach: 100,
            afterEach: 100,
            afterAll: 5000
        }
    },
    // before() {},
    // after() {},
    // beforeEach() {},
    // afterEach() {},
    // beforeAll() {},
    // afterAll() {},
    name: undefined,
    uri: undefined,
    agent: {}, // any agent is ok, but you can provide {type: 'browser', name: 'firefox'}
    state: 'idle', // idle, setup, config, main, run, done
    configActions: [], // dependencies
    runActions: [], // dependents
    currentAction: undefined,
    currentHook: undefined,

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

        // inherit from action uri
        if (this.uri && !action.uri) {
            action.uri = this.uri;
        }

        list.push(action);

        return action;
    },

    config(...args) {
        if (this.state !== 'idle' && this.state !== 'setup' && this.state !== 'config') {
            throw new Error('config() must be called during idle, setup or config');
        }

        var action = this.make(...args);
        action.parent = this;
        action.isConfig = true;
        action.options = Options.create(this.options);

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

    createMain(data) {
        if (typeof data === 'function') {
            return data;
        } else if (typeof data === 'string') {
            var lazyModule = LazyModule.create();
            lazyModule.parentLocation = this.uri.href;
            lazyModule.location = data;
            var main = function() {
                return lazyModule.import();
            };
            main.lazyModule = lazyModule;
            return main;
        }
        throw new TypeError('createMain expect string or function');
    },

    populate(properties) {
        if (typeof properties === 'object') {
            Object.assign(this, properties);
        } else {
            this.main = this.createMain(properties);
            if (!this.name) {
                this.name = this.main.name;
            }
        }
    },

    callHook(name) {
        return ActionHook.create(this, name);
    },

    getSkipReason() {
        let skipReason = this.skipReason;

        if (!skipReason) {
            if (this.configActions.length === 0 && this.runActions.length === 0 && !this.main) {
                skipReason = 'no config/main/run hook';
            }
        }
        if (!skipReason) {
            let engineAgent = env.agent;
            let expectedAgent = this.agent;
            let canRunOnAgent = engineAgent.match(expectedAgent);

            if (canRunOnAgent === false) {
                skipReason = 'unsupported agent : ' + engineAgent + ' (expecting' + JSON.stringify(expectedAgent) + ')';
            }
        }

        return skipReason;
    },

    get duration() {
        return this.endDate ? this.endDate - this.startDate : 0;
    },

    forceValue(value) {
        if (this.value instanceof Error) {
            console.warn('force value ignored because the current value is an error and must not be override');
        } else {
            this.value = value;
        }

        return value;
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

    },

    settle(value, resolved) {
        this.value = value;
        this.settled = true;
        if (resolved) {
            this.resolved = true;
        } else {
            this.rejected = true;
        }

        if (this.currentHook) { // clean the timeout in case there is one and he is not over
            this.currentHook.clear();
        }

        return this.transform();
    },

    cancel(reason = 'no cancel reason specified') {
        if (this.settled) {
            throw new Error('cancel(' + reason + ') must not be called once action is settled');
        }

        this.cancelReason = reason;
        this.cancelled = true;
        env.debug(this.name, 'cancelled because:', reason);

        if (this.currentHook) { // clean the timeout in case there is one and he is not over
            this.currentHook.clear();
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

    // expire() {
    //     this.timeout.expire();
    //     this.cancel('expired');
    // },

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
            this.currentAction = action;
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
                // jsenv.debug('exec', this.name);
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
                // jsenv.debug(this.name, ': setup');
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
                // jsenv.debug(this.name, ': main');
                this.state = 'main';
                return this.createMainPromise();
            },
            function(value) {
                // jsenv.debug(this.name, ': run');
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
        this.startDate = this.endDate = this.result = this.value = this.currentAction = this.currentHook = undefined;

        // reset should reset runActions created during the main hook
        // this.runActions.length = 0;
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
