// https://chromium.googlesource.com/v8/v8/+/master/docs/javascript_stack_trace_api.md
import stringifyCallSite from './callsite-stringify.js';
import parseCallSite from './callsite-parse.js';

var CallSite = {
    source: null,
    fileName: null,
    functionName: null,
    fromNative: false,
    fromConstructor: false,
    fromToplevel: false,
    fromEval: false,
    lineNumber: null,
    columnNumber: null,
    typeName: null,
    sourceURL: null,

    evalFileName: null,
    evalLineNumber: null,
    evalColumnNumber: null,

    constructor: function(properties) {
        properties = properties || {};

        for (var property in properties) { // eslint-disable-line
            this[property] = properties[property];
        }
    },

    isEval: function() {
        return Boolean(this.fromEval);
    },

    isNative: function() {
        return Boolean(this.fromNative);
    },

    isConstructor: function() {
        return Boolean(this.fromConstructor);
    },

    isToplevel: function() {
        return Boolean(this.fromToplevel);
    },

    // returns callsite corresponding to the eval call origin
    getEvalOrigin: function() {
        return new this.constructor({
            fileName: this.evalFileName,
            lineNumber: this.evalLineNumber,
            columnNumber: this.evalColumnNumber
        });
    },

    getFileName: function() {
        return this.source ? this.source : this.fileName;
    },

    getFunctionName: function() {
        return this.functionName;
    },

    getMethodName: function() {
        return this.getFunctionName();
    },

    getTypeName: function() {
        return this.typeName;
    },

    getLineNumber: function() {
        return this.lineNumber;
    },

    getColumnNumber: function() {
        return this.columnNumber;
    },

    // Most call sites will return the source file from getFileName(), but code
    // passed to eval() ending in "//# sourceURL=..." will return the source file
    // from getScriptNameOrSourceURL() instead
    getScriptNameOrSourceURL: function() {
        if (this.source) {
            return this.source;
        }
        if (this.sourceURL) {
            return this.sourceURL;
        }
        return this.getFileName();
    },

    toJSON: function() {
        var properties = {};
        Object.getOwnPropertyNames(this).forEach(function(name) {
            properties[name] = this[name];
        }, this);

        return properties;
    },

    toString: function() {
        return stringifyCallSite(this);
    }
};

CallSite.constructor.prototype = CallSite;
CallSite = CallSite.constructor;

CallSite.parseLine = parseCallSite;

CallSite.parse = function(line) {
    var properties;

    try {
        properties = this.parseLine(line);
    } catch (e) {
        console.warn('error parsing line', line, e);
        properties = {};
    }

    return new this(properties);
};

CallSite.parseAll = function(lines) {
    return lines.map(function(line) {
        return this.parse(line);
    }, this);
    /* .filter(function(callSite){
        return Boolean(callSite);
    });
    */
};

CallSite.parseStack = function(stack) {
    var stackSource = stack;
    return this.parseAll(stackSource.split('\n').slice(1));
};

CallSite.parseError = function(error) {
    return this.parseStack(error.stack);
};

CallSite.stringifyAll = function(callSiteList) {
    return callSiteList.map(function(callSite) {
        return String(callSite);
    });
};

CallSite.create = function() {
    var instance = Object.create(this.prototype);

    instance.constructor.apply(instance, arguments);

    return instance;
};

export default CallSite;
