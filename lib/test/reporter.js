import CoreConsoleReporter from './reporter/console-core.js';
import ConsoleJSONReporter from './reporter/console-json.js';
import JSONReporter from './reporter/json.js';

import proto from 'proto';

var Reporter = proto.extend('TestReporter', {
    reporters: {},

    /* eslint-disable no-unused-vars */
    events: {
        // called before executing a test
        start: function(testFileLocations) {},
        // called after a test failed (nothing can happen anymore except end event)
        fail: function(test, value) {},
        // called after a test passed
        pass: function(test, value) {},
        // called after a test failed/passed
        end: function(test, value, resolved) {}
    },
    /* eslint-enable no-unused-vars */

    constructor: function() {

    },

    emit: function(name) {
        if (name in this.events) {
            this.events[name].apply(this, Array.prototype.slice.call(arguments, 1));
        }
    },

    close: function() {

    }
});

var ReporterFactory = proto.extend('RepoterFactory', {
    reporters: {},

    get: function(type) {
        return this.reporters[type];
    },

    set: function(type, reporter) {
        this.reporters[type] = reporter;
    },

    create: function(type) {
        var ReporterType = this.get(type);
        var reporter;

        reporter = ReporterType.create.apply(ReporterType, Array.prototype.slice.call(arguments, 1));

        return reporter;
    },

    register: function(type, properties) {
        var TypeReporter = Reporter.extend(properties);

        return this.set(type, TypeReporter);
    }
});

ReporterFactory.register('console-core', CoreConsoleReporter);
ReporterFactory.register('console-json', ConsoleJSONReporter);
ReporterFactory.register('json', JSONReporter);

var ReportHandler = proto.extend('ReportHandler', {
    constructor: function() {
        this.reporters = [];
    },

    use: function(...args) {
        var reporter = ReporterFactory.create(...args);

        this.reporters.push(reporter);
    },

    emit: function() {
        var args = arguments;

        this.reporters.forEach(function(reporter) {
            reporter.emit.apply(reporter, args);
        });
    },

    close: function() {
        this.reporters.forEach(function(reporter) {
            reporter.close();
        });
    }
});

export default ReportHandler;
