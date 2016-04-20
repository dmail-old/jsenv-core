import jsenv from 'jsenv';
import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import Timeout from 'jsenv/timeout';
import Thenable from 'jsenv/thenable';
import Iterable from 'jsenv/iterable';

function pipe(methods, initialValue, condition) {
    var iterableMethods = Iterable.map(methods, function(method) {
        return Thenable.callFunction(method, this);
    }, this);

    return Iterable.reduceToThenable(iterableMethods, initialValue, condition);
}

/*
function createTimeoutError(hookName, timeoutDuration) {
    var error = new Error();

    error.code = 'HOOK_TIMEOUT';
    error.message = hookName + ' hook is too slow (more than ' + timeoutDuration + ' ms)';

    return error;
}
*/

let LazyModule = proto.extend('LazyModule', {
    options: Options.create({
        timeouts: Options.create({
            before: 5000,
            fn: 100,
            after: 5000,
            beforeAll: 5000,
            beforeEach: 100,
            afterEach: 100,
            afterAll: 5000
        })
    }),
    // before() {},
    // after() {},
    // beforeAll() {},
    // afterAll() {},
    // beforeEach() {},
    // afterEach() {},
    name: undefined,
    url: undefined,
    location: undefined,
    source: undefined,
    exports: undefined,
    agent: {}, // any agent is ok, but you can provide {type: 'browser', name: 'firefox'}

    state: '', // 'resolved', 'rejected', ''
    pending: false,
    cancelled: false,
    skipped: false,
    expired: false,

    constructor() {
        this.children = [];

        if (arguments.length === 1) {
            this.populate(arguments[0]);
        } else if (arguments.length === 2) {
            this.name = arguments[0];
            this.populate(arguments[1]);
        }
    },

    populate(properties) {
        if (typeof properties === 'object') {
            this.exports = properties;
        } else if (typeof properties === 'function') {
            this.exports = {
                fn: properties
            };
        } else if (typeof properties === 'string') {
            this.url = properties;
            if (this.hasOwnProperty('name') === false) {
                this.name = properties;
            }
        }
    },

    add(...args) {
        var childModule;
        if (LazyModule.isPrototypeOf(arguments[0])) {
            childModule = arguments[0];
        } else {
            childModule = Object.getPrototypeOf(this).create(...args);
        }

        this.children.push(childModule);
        childModule.parent = this;
        childModule.options = Options.create(this.options);

        return childModule;
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

    createChildPromise(childTest) {
        return pipe([
            function() {
                return this.callHook('beforeEach');
            },
            function() {
                return childTest.exec();
            },
            function() {
                return this.callHook('afterEach');
            }
        ]);
    },

    createChildrenPromise() {
        var methods = [
            function() {
                return this.callHook('beforeAll');
            },
            function() {
                var childrenPromises = Iterable.map(this.children, this.createChildPromise, this);
                return Iterable.reduceToThenable(childrenPromises);
            },
            function() {
                return this.callHook('afterAll');
            }
        ];

        return pipe(methods);
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

    find() {
        var normalizedNamePromise;

        if (this.url) {
            normalizedNamePromise = System.normalize(this.url, this.parent ? this.parent.location : null);
        } else {
            normalizedNamePromise = System.normalize(this.name, this.parent ? this.parent.location : null);
        }

        return normalizedNamePromise.then(function(normalizedName) {
            this.normalizedName = normalizedName;
            return normalizedName;
        }.bind(this));
    },

    load() {
        return this.find().then(function(normalizedName) {
            if (this.source) {
                this.debug('get mainModule from source string');
                return System.module(this.mainSource, {
                    address: normalizedName
                });
            }
            if (this.exports) {
                this.debug('get mainModule from source object');
                var module = System.newModule(this.exports);
                System.set(normalizedName, module);
                return module;
            }
            this.debug('get mainModule from source file', normalizedName);
            return System.import(normalizedName);
        }).then(function(module) {
            this.debug('module imported', module);
            this.module = module;

            // module exports are assigned to this
            // Object.assign(this, module);

            return module;
        });
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
                return this.load();
            },
            function() {
                return this.callHook('after');
            },
            function(value) {
                return this.children.length ? this.createChildrenPromise() : value;
            }
        ];

        var promise = pipe(methods, undefined, function() {
            return this.cancelled === false;
        }.bind(this));

        return Thenable.after(promise, function(value, resolved) {
            this.settle(value, resolved);
            this.clean();
        }, this);
    }
});

function createCachedThenableMethod(object, methodName) {
    var oldMethod = object[methodName];
    var currentPromise;

    return function() {
        if (currentPromise) {
            return currentPromise;
        }
        currentPromise = oldMethod.apply(this, arguments);
        return currentPromise;
    };
}

// cache normalize, import & exec
[
    'normalize',
    'import',
    'exec'
].forEach(function(methodName) {
    LazyModule[methodName] = createCachedThenableMethod(LazyModule[methodName]);
});

export default LazyModule;
