import CoreConsoleReporter from './reporter/console-core.js';
import ConsoleJSONReporter from './reporter/console-json.js';
import JSONReporter from './reporter/json.js';

import proto from 'jsenv/proto';

var Reporter = proto.extend('TestReporter', {
    /* eslint-disable no-unused-vars */
    events: {
        // called before executing a test
        start(testFileLocations) {},
        // called after a test failed (nothing can happen anymore except end event)
        fail(test, value) {},
        // called after a test passed
        pass(test, value) {},
        // called after a test failed/passed
        end(test, value, resolved) {}
    },
    /* eslint-enable no-unused-vars */

    constructor() {

    },

    emit(name, ...args) {
        if (name in this.events) {
            this.events[name].apply(this, args);
        }
    },

    close() {

    }
});

var ReporterFactory = proto.extend('ReporterFactory', {
    reporters: {},

    get(type) {
        return this.reporters[type];
    },

    set(type, reporter) {
        this.reporters[type] = reporter;
    },

    create(type, ...args) {
        var ReporterType = this.get(type);
        var reporter;

        reporter = ReporterType.create(...args);

        return reporter;
    },

    register(type, properties) {
        var TypeReporter = Reporter.extend(properties);

        return this.set(type, TypeReporter);
    }
});

ReporterFactory.register('console-core', CoreConsoleReporter);
ReporterFactory.register('console-json', ConsoleJSONReporter);
ReporterFactory.register('json', JSONReporter);

var ReportHandler = proto.extend('ReportHandler', {
    constructor() {
        this.reporters = [];
    },

    use(...args) {
        var reporter = ReporterFactory.create(...args);

        this.reporters.push(reporter);
    },

    emit() {
        var args = arguments;

        this.reporters.forEach(function(reporter) {
            reporter.emit(...args);
        });
    },

    close() {
        this.reporters.forEach(function(reporter) {
            reporter.close();
        });
    }
});

export default ReportHandler;
