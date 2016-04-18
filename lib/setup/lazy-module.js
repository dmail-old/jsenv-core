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
    modules: [],
    name: undefined,
    location: undefined,
    source: undefined,
    exports: undefined,

    pending: false,
    skipped: false,
    expired: false,
    resolved: false,
    rejected: false,

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

    normalize() {
        var normalizedName;
        if (this.url) {
            normalizedName = System.normalize(this.url, this.parent ? this.parent.location : null);
        } else {
            normalizedName = System.normalize(this.name, this.parent ? this.parent.location : null);
        }
        return normalizedName;
    },

    import() {
        return this.normalize().then(function(normalizedName) {
            this.location = normalizedName;
            jsenv.debug('importing', normalizedName);
            return System.import(normalizedName);
        }.bind(this));
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
            }
        }

        return hookPromise;
    },

    getSkipReason() {
        let skipReason;
        var canRunOnAgent;
        var engineAgent = jsenv.agent;

        if (this.hasOwnProperty('agents')) {
            canRunOnAgent = this.agents.some(function(agent) {
                return engineAgent.is(agent);
            });
        } else if (engineAgent.name !== 'node' && this.hasNodeModuleImport()) {
            canRunOnAgent = false;
        } else {
            canRunOnAgent = true;
        }

        if (canRunOnAgent === false) {
            skipReason = 'unsupported agent : ' + engineAgent;
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
                return childTest.start();
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

    cancel() {
        if (this.pending === false) {
            throw new Error('cancel() must be called while task is pending');
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
        if (this.pending) {
            this.cancel();
        }
    },

    settle(value, resolved) {
        this.value = value;
        this.state = resolved ? 'resolved' : 'rejected';
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

    start() {
        this.startDate = new Date();

        var methods = [
            function() {
                return this.callHook('before');
            },
            function() {
                return this.import();
            },
            function() {
                if (!this.skipped) {
                    var skipReason = this.getSkipReason();
                    if (skipReason) {
                        this.skip(skipReason);
                    }
                }
            },
            this.loadModules,
            function() {
                return this.callHook('fn');
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

        promise = Thenable.after(promise, function(value, resolved) {
            this.settle(value, resolved);
            this.clean();
        }, this);

        return promise;
    }
});

export default LazyModule;
