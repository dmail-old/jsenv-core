import proto from 'proto';
import engine from 'engine';

// import Reporter from './reporter.js';

import Options from '../../node_modules/@dmail/options/index.js';
import Timeout from '../../node_modules/@dmail/timeout/index.js';
import Thenable from '../../node_modules/@dmail/thenable/index.js';
import Iterable from '../../node_modules/@dmail/iterable/index.js';

function createTimeoutError(test, timeoutDuration) {
    var error = new Error();

    error.code = 'TEST_TIMEOUT';
    error.message = 'test ' + test.name + ' is too slow (more than ' + timeoutDuration + ' ms)';

    return error;
}

function createAbortedError(test) {
    var error = new Error();

    error.code = 'TEST_ABORT';
    error.message = 'test ' + test.name + ' was aborted';

    return error;
}

let defaultOptions = Options.create({
    json: false,
    silent: false,
    reporter: null,

    timeouts: Options.create({
        before: 5000,
        fn: 100,
        after: 5000,
        beforeAll: 5000,
        beforeEach: 100,
        afterEach: 100,
        afterAll: 5000
    })
});

const Test = proto.extend('Test', {
    options: defaultOptions,
    fn: null,
    url: '',
    name: 'no name',
    caller: null,
    modules: [],
    children: [],
    parent: null,

    constructor() {
        // this.caller = caller;
        // we should get the caller from the callstack and we're done no?
        // well nope because test may come from a call located in a file
        this.children = [];
        this.reset();

        if (arguments.length === 0) {
            throw new TypeError('missing test function');
        }
        let name;
        let fn;
        if (typeof arguments[0] === 'function') {
            fn = arguments[0];
            name = fn.name;
        } else if (typeof arguments[0] === 'string') {
            fn = arguments[1];
            name = arguments[0];
        }

        if (typeof fn !== 'function') {
            throw new TypeError('test first argument must be a function');
        }

        this.fn = fn;
        this.name = name;
        if (fn.modules) {
            this.modules = fn.modules;
        }
    },

    toJSON() {
        var properties = {
            name: this.name,
            state: this.state,
            startDate: this.startDate,
            endDate: this.endDate,
            result: this.result,
            caller: this.caller
        };

        if (this.hasOwnProperty('failureExpected')) {
            properties.failureExpected = this.failureExpected;
        }
        if (this.hasOwnProperty('timeoutExpected')) {
            properties.timeoutExpected = this.timeoutExpected;
        }

        return properties;
    },

    addTest(childTest) {
        this.children.push(childTest);
        childTest.parent = this;
        childTest.options = Options.create(this.options);
        return childTest;
    },

    /*
    deprecated for now but in short it should be possible to explicitely force the test of an other module
    addFile() {
        var absoluteURL = this.uri.locate(relativeOrAbsoluteLocation);
        var childTest = Object.getPrototypeOf(this).create(absoluteURL.href);

        return this.addTest(childTest);
    },
    */

    add() {
        let prototype = Object.getPrototypeOf(this);
        let test = prototype.create.apply(this, arguments);

        return this.addTest(test);
    },

    reset() {
        this.state = 'created';
        this.current = null;
    },

    get depth() {
        var depth = 0;
        var parent = this.parent;
        while (parent) {
            depth++;
            parent = parent.parent;
        }
        return depth;
    },

    getSelfOrParentProperty(property) {
        if (this.hasOwnProperty(property)) {
            return this[property];
        } else if (this.parent) {
            return this.parent.getSelfOrParentProperty(property);
        }
        return undefined;
    },

    emit() {
        var reporter = this.options.reporter;

        if (reporter) {
            reporter.emit.apply(reporter, arguments);
        }
    },

    isNodeModule(moduleName) {
        return moduleName.indexOf('node/') === 0;
    },

    hasNodeModuleImport() {
        return this.modules.some(this.isNodeModule, this);
    },

    filter() {
        // var relevant;

        // force skipped state when there is a skipReason
        if (this.skipReason) {
            this.skip(this.skipReason);
        } else {
            var canRunOnAgent;
            var engineAgent = engine.agent;

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
                this.skip('unsupported agent : ' + engineAgent);
            }
        }
    },

    callHook(name) {
        const method = this[name];
        let hookPromise = Thenable.applyFunction(method, this, this.modules).catch(function(value) {
            if (value instanceof Error) {
                return Promise.reject(value);
            }
            var error = new Error(name + ' suite hook was rejected with ' + value);
            return Promise.reject(error);
        });
        const timeouts = this.options.timeouts;

        if (name in timeouts) {
            this.timeout = Timeout.create(this.expire, this, timeouts[name]);
            hookPromise = Thenable.after(hookPromise, function() {
                this.timeout.delete(); // timeout useless when hook is settled
            }, this);
        }

        return hookPromise;
    },

    loadModules() {
        var moduleImportPromises = this.modules.map(function(module) {
            return System.import(module, this.url).then(function(exports) {
                if (this.isNodeModule(module)) {
                    return exports.default;
                }
                if (this.mapDefaultExports && 'default' in exports) {
                    return exports.default;
                }
                return exports;
            }.bind(this));
        }, this);

        return Promise.all(moduleImportPromises).then(function(modules) {
            this.modules = modules;
        }.bind(this));
    },

    createCallPromise() {
        var methods = [
            function() {
                return this.callHook('before');
            },
            this.filter,
            this.loadModules,
            function() {
                if (this.fn) {
                    return this.callHook('fn');
                    // var args = [this.add.bind(this)];
                    // args.push.apply(args, this.modules);
                    // return this.fn.apply(this, args);
                }
            }
        ];

        var iterableMethods = Iterable.map(methods, function(method) {
            return Thenable.callFunction(method, this);
        }, this);

        return Iterable.reduceToThenable(iterableMethods, undefined, function() {
            return this.state === 'skipped';
        }, this);
    },

    before() {},
    after() {},
    beforeAll() {},
    afterAll() {},
    beforeEach() {},
    afterEach() {},

    get duration() {
        return this.endDate ? this.endDate - this.startDate : 0;
    },

    cancel() {
        if (this.promise.cancel) {
            this.promise.cancel();
        }
    },

    expire() {
        this.reject(createTimeoutError(this, this.timeout.value));
    },

    abort() {
        this.reject(createAbortedError(this));
    },

    skip(reason) {
        if (this.state !== 'skipped') {
            if (arguments.length > 0) {
                this.skipReason = reason;
            }

            if (this.state === 'started') {
                this.state = 'skipped';
                this.abort();
            } else if (this.state === 'created') {
                this.state = 'skipped';
            } else if (this.state !== 'created') {
                throw new Error('test.skip(' + reason + ') called after test was runned');
            }
        }
    },

    createChildPromise(childTest) {
        return Thenable.after(
            this.callHook('beforeEach').then(function() {
                return childTest.exec();
            }),
            function() {
                this.callHook('afterEach');
            },
            this
        );
    },

    createChildrenPromise() {
        return Thenable.after(
            this.callHook('beforeAll').then(function() {
                var childrenPromises = Iterable.map(this.children, this.createChildPromise, this);
                return Iterable.reduceToThenable(childrenPromises);
            }.bind(this)),
            function() {
                return this.callHook('afterAll');
            },
            this
        );
    },

    createStatePromise() {
        if (this.state === 'skipped') {
            return Promise.resolve();
        }

        this.state = 'started';
        this.promise = new Promise(function(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
        }.bind(this));

        return this.promise;
    },

    onResolve(resolutionValue) {
        if (this.failureExpected) {
            throw new Error('test expected to fail has passed with' + resolutionValue);
        }
        if (this.timeoutExpected) {
            throw new Error('test expected to timeout has passed with' + resolutionValue);
        }

        return resolutionValue;
    },

    onReject(rejectionValue) {
        if (this.state === 'skipped') {
            return undefined;
        }

        if (this.failureExpected) {
            if (rejectionValue instanceof Error && rejectionValue.code === 'TEST_TIMEOUT') {
                throw new Error('test expected to fail has timed out after ' + this.timeout.value);
            }
            return rejectionValue; // catch failure
        }

        if (this.timeoutExpected) {
            if (rejectionValue instanceof Error === false || rejectionValue.code !== 'TEST_TIMEOUT') {
                throw new Error('test expected to timeout has failed with' + rejectionValue);
            }
            return rejectionValue; // catch timeout
        }

        return Promise.reject(rejectionValue);
    },

    onBoth(value, resolved) {
        this.endDate = new Date();

        if (this.state === 'skipped') {
            // do nothing
        } else if (resolved) {
            this.state = 'passed';
        } else if (value instanceof Error) {
            if (value.code === 'TEST_ABORT') {
                this.state = 'aborted';
            } else if (value.code === 'TEST_TIMEOUT') {
                this.state = 'timedout';
            } else {
                this.state = 'errored';
            }
        } else {
            this.state = 'failed';
        }

        this.result = value;

        if (this.state === 'passed' || this.state === 'skipped') {
            this.emit('pass', this, value);
        } else {
            this.emit('fail', this, value);
        }
        this.emit('end', this, value, resolved);

        // close reporter
        var reporter = this.options.reporter;
        if (reporter) {
            reporter.close();
        }
    },

    exec() {
        this.startDate = new Date();
        this.emit('start', this);

        var statePromise = this.createStatePromise();
        var donePromise;

        donePromise = Thenable.after(statePromise, function() {
            return this.callHook('after');
        }.bind(this)).then(function(value) {
            return this.children.length ? this.createChildrenPromise() : value;
        }.bind(this)).then(
            this.onResolve.bind(this),
            this.onReject.bind(this)
        );

        donePromise = Thenable.after(donePromise, this.onBoth, this);

        this.createCallPromise().then(
            this.resolve.bind(this),
            this.reject.bind(this)
        );

        return donePromise;
    }
});

export default Test;
