import proto from 'jsenv/proto';
import Action from 'jsenv/action';

import Options from 'jsenv/options';
import Thenable from 'jsenv/thenable';
import Iterable from 'jsenv/iterable';

let Test = proto.extend.call(Action, {
    location: '',
    caller: null,
    modules: [],
    children: [],
    parent: null,

    options: Options.create(Action.options, {
        json: false,
        silent: false,
        reporter: null,

        timeouts: {
            before: 5000,
            fn: 100,
            after: 5000,
            beforeAll: 5000,
            beforeEach: 100,
            afterEach: 100,
            afterAll: 5000
        }
    }),

    // beforeAll() {},
    // afterAll() {},
    // beforeEach() {},
    // afterEach() {},

    constructor() {
        this.children = [];
        this.reset();

        if (arguments.length === 0) {
            throw new TypeError('missing test first argument');
        }
        if (typeof arguments[0] === 'object') {
            Object.assign(this, arguments[0]);
        } else if (typeof arguments[0] === 'function') {
            this.fn = arguments[0];
            this.name = this.fn.name;
        } else if (typeof arguments[0] === 'string') {
            this.fn = arguments[1];
            this.name = arguments[0];
        }

        if (typeof this.fn !== 'function') {
            throw new TypeError('test first argument must be a function');
        }

        if (this.useSomeNodeModule()) {
            this.agent = {
                type: 'node'
            };
        }

        // Action.constructor.call(this);
    },

    isNodeModule(moduleName) {
        return moduleName.startsWith('@node/');
    },

    useSomeNodeModule() {
        return this.modules.some(this.isNodeModule, this);
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

    emit() {
        var reporter = this.options.reporter;

        if (reporter) {
            reporter.emit.apply(reporter, arguments);
        }
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

    transform() {
        Action.transform.call(this);

        var value = this.value;

        if (this.rejected) {
            if (this.timeoutExpected) {
                this.forceValue(new Error('test expected to timeout has rejected with' + value));
            } else if (this.failureExpected) {
                // catch rejection
                this.forceResolve();
            }
        }
        if (this.resolved) {
            if (this.timeoutExpected) {
                // not expected to resolve
                this.forceReject(new Error('test expected to timeout has passed with' + value));
            } else if (this.failureExpected) {
                // not expected to resolve
                this.forceReject(new Error('test expected to fail has passed with' + value));
            }
        }
        if (this.expired) {
            if (this.timeoutExpected) {
                // catch timeout
                this.forceResolve();
            } else if (this.failureExpected) {
                // we timedout while expecting to fail, we'll let just basic timeout error
                // throw timeout (already done in action.js)
            }
        }

        if (this.rejected) {
            this.state = 'failed';
        } else if (this.resolved) {
            this.state = 'passed';
        }

        if (this.state === 'passed') {
            this.emit('pass', this, value);
        } else {
            this.emit('fail', this, value);
        }
        this.emit('end', this, value);

        // close reporter
        var reporter = this.options.reporter;
        if (reporter) {
            reporter.close();
        }
    },

    listOperations() {
        var operations = [];

        operations.push(
            function() {
                this.emit('start', this);
            },
            function() {
                return this.loadModules();
            }
        );

        operations.concat(Action.listOperations.call(this));

        operations.push(
            function(value) {
                return this.children.length ? this.createChildrenPromise() : value;
            }
        );

        return operations;
    }
});

export default Test;
