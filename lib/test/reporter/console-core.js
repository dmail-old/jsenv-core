/*
function reportErrorStackTrace(error) {
    return error.toString();
}

function reportValue(value) {
    if (value) {
        if ( value.stackTrace) {
            return reportErrorStackTrace(value);
        }
        if (value.stack) {
            if (value.inspect) {
                return value.inspect() + '\n';
            }
            return value.stack;
        }
        return String(value) + '\n';
    }
    //return 'no error';
    return '';
}
*/

var SuiteConsoleReporter = {
    verbose: false,

    constructor: function(options) {
        Object.assign(this, options);
        if (this.hasOwnProperty('stream') === false) {
            this.stream = process.stdout;
        }
    },

    write: function(message) {
        if (typeof message !== 'string') {
            console.log(message);
            throw new TypeError('string expected ' + message);
        }

        this.stream.write(message);
    },

    events: {
        start: function(test) {
            if (test.depth === 0) {
                this.write(test.name + '\n');
            } else if (test.depth === 1) {
                this.write('\t' + test.name + ' : ');
            } else {
                // dont log too much information
            }
        },

        fail: function(test/* , value */) {
            // write for test of depth 1 only
            if (test.depth === 0) {
                // this.write(reportValue(value) + '\n');
            } else if (test.depth === 1) {
                this.write('failed (' + test.duration + ' ms)\n');
            } else {
                // don't log too much
            }
        },

        pass: function(test/* , value */) {
            if (test.depth === 0) {
                if (test.state === 'skipped') {
                    this.write('\tskipped (' + test.skipReason + ')\n');
                } else if (test.exported === false) {
                    // specific to test file, should be done no matter the depth
                    this.write('\tno test exported\n');
                } else if (test.children.length === 0) {
                    this.write('\tno test added\n');
                }
            } else if (test.depth === 1) {
                if (test.state === 'skipped') {
                    this.write('skipped (' + test.skipReason + ')\n');
                } else {
                    this.write('passed\n');
                }
            } else {
                // dont log too much
            }
        }
    }
};

export default SuiteConsoleReporter;
