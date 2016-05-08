// import jsenv from 'jsenv';
import proto from 'jsenv/proto';
import Action from 'jsenv/action';

import Options from 'jsenv/options';
// import Thenable from 'jsenv/thenable';
// import Iterable from 'jsenv/iterable';

let Test = proto.extend.call(Action, {
    location: '',
    caller: null,
    modules: [],

    options: Options.create(Action.options, {
        json: false,
        silent: false,
        reporter: null,

        timeouts: {
            before: 5000,
            main: 100,
            after: 5000,
            beforeAll: 5000,
            beforeEach: 100,
            afterEach: 100,
            afterAll: 5000
        }
    }),

    constructor() {
        Action.constructor.apply(this, arguments);

        if (this.useSomeNodeModule()) {
            this.agent = {
                type: 'node'
            };
        }

        this.modules.forEach(function(module, index) {
            this.config(this.name + ':load-module-' + index, function() {
                return System.import(module, this.location).then(function(exports) {
                    if (this.shouldExportDefault(exports, module)) {
                        return exports.default;
                    }
                    return exports;
                }.bind(this));
            });
        }, this);
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

    add(...args) {
        return this.run(...args);
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

    shouldExportDefault(exports) {
        return 'default' in exports && Object.keys(exports).length === 1;
    },

    transform() {
        Action.transform.call(this);

        let value = this.value;

        // if (this.rejected) {
        //     if (this.timeoutExpected) {
        //         this.forceValue(new Error('test expected to timeout has rejected with' + value));
        //     } else if (this.failureExpected) {
        //         // catch rejection
        //         this.forceResolve();
        //     }
        // }
        // if (this.resolved) {
        //     if (this.timeoutExpected) {
        //         // not expected to resolve
        //         this.forceReject(new Error('test expected to timeout has passed with' + value));
        //     } else if (this.failureExpected) {
        //         // not expected to resolve
        //         this.forceReject(new Error('test expected to fail has passed with' + value));
        //     }
        // }
        // // expired ne marche plus, en fait faudrais test si le timeout se produit durant main
        // // dans ce cas on sait qu'on est expired
        // if (this.expired) {
        //     if (this.timeoutExpected) {
        //         // catch timeout
        //         this.forceResolve();
        //     } else if (this.failureExpected) {
        //         // we timedout while expecting to fail, we'll let just basic timeout error
        //         // throw timeout (already done in action.js)
        //     }
        // }

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

    startEffect() {
        Action.startEffect.call(this);
        this.emit('start', this);
    }
});

export default Test;
