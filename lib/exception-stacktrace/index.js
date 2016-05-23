// move this to stackTrace when source-map work on browser too

import jsenv from 'jsenv';

import exceptionHandler from 'jsenv/exception-handler';
import StackTrace from 'jsenv/stacktrace';

import SourceMap from 'source-map';

var sourceMaps = jsenv.importMetas.sourceMaps;
var SourceMapConsumer = SourceMap.SourceMapConsumer;

var consumers = {};
function getSourceMapConsumer(location) {
    var consumer;

    if (location in consumers) {
        consumer = consumers[location];
    } else {
        var sourceMap = sourceMaps.get(location);
        if (sourceMap) {
            consumer = new SourceMapConsumer(sourceMap);
        }
        consumers[location] = consumer;
    }

    return consumer;
}

function mapSourcePosition(position) {
    var sourceLocation = position.source;
    var consumer = getSourceMapConsumer(sourceLocation);

    if (consumer) {
        var originalPosition = consumer.originalPositionFor(position);

        // Only return the original position if a matching line was found. If no
        // matching line is found then we return position instead, which will cause
        // the stack trace to print the path and line for the compiled file. It is
        // better to give a precise location in the compiled file than a vague
        // location in the original file.
        if (originalPosition.source !== null) {
            return originalPosition;
        }
    }

    return position;
}

function transformCallSite(callSite, index, callSites) {
    var sourceLocation = callSite.getScriptNameOrSourceURL() || callSite.getFileName();

    if (sourceLocation) {
        var line = callSite.getLineNumber();
        var column = callSite.getColumnNumber() - 1;

        // Fix position in Node where some (internal) code is prepended.
        // See https://github.com/evanw/node-source-map-support/issues/36
        var fromModule = jsenv.isNode() && callSites.length &&
        callSites[callSites.length - 1].getFileName() === 'module.js';
        if (fromModule && line === 1) {
            column -= 63;
        }

        var position = mapSourcePosition({
            source: sourceLocation,
            line: line,
            column: column
        });

        callSite.source = position.source;
        callSite.lineNumber = position.line;
        callSite.columnNumber = position.column + 1;
    }

    // if( callSite.isEval() ){
    //     console.log('handling isEval calls');
    //
    //     var evalOrigin = callSite.getEvalOrigin();
    //     var evalSsource = evalOrigin.getFileName() || evalOrigin.getScriptNameOrSourceURL();
    //     var evalLine = evalOrigin.getLineNumber();
    //     var evalColumn = evalOrigin.getColumnNumber() - 1;
    //
    //     var evalPosition =  mapSourcePosition({
    //         source: source,
    //         line: evalSsource,
    //         column: evalColumn
    //     });
    //
    //     callSite.evalFileName = evalPosition.source;
    //     callSite.evalLineNumber = evalPosition.line;
    //     callSite.evalColumnNumber = evalPosition.column + 1;
    // }

    // Code called using eval() needs special handling
    // if( callSite.isEval() ){
    //     var evalOrigin = callSite.getEvalOrigin();
    //
    //   if( evalOrigin ){
    //         mapCallSite(evalOrigin);
    //     }
    // }

    // console.log('mapping', source, 'into', callSite.source);
}

StackTrace.setTransformer(transformCallSite);

// we must make this cross platform or it's pretty useless
/*
engine.trace = function(error) {
    var stack; // eslint-disable-line no-unused-vars
    var stackTrace;

    if (arguments.length > 0) {
        if ((error instanceof Error) === false) {
            throw new TypeError('engine.trace() first argument must be an error');
        }

        stack = error.stack; // will set error.stackTrace
        stackTrace = error.stackTrace;
    } else {
        error = new Error();
        stack = error.stack; // will set error.stackTrace
        stackTrace = error.stackTrace;
        stackTrace.callSites.shift(); // remove this line of the stack trace
    }

    return stackTrace;
};
*/

exceptionHandler.throw = function(exceptionValue) {
    // we don't need this anymore thanks to Error.prepareStackTrace in @dmail/node-stacktrace
    // StackTrace.install(exceptionValue);

    // if we throw we'll get useless line saying we throwed error, thats why we use console.error
    // exceptionValue.stack;
    // throw exceptionValue;

    console.error(exceptionValue);
    process.exit(1);
};

/*
jsenv.build(function improveSyntaxError() {
    var improveSyntaxError = function(error) {
        if (error && error.name === 'SyntaxError' && error._babel) {
            // error.loc contains {line: 0, column: 0}
            var match = error.message.match(/([\s\S]+): Unterminated string constant \(([0-9]+)\:([0-9]+)/);
            if (match) {
                var improvedError = new SyntaxError();
                var column = match[3];
                column += 63; // because node-sourcemap/index.js:155 will do column-=63
                var stack = '';
                stack += 'SyntaxError: Unterminated string constant\n\t at ';
                stack += match[1] + ':' + match[2] + ':' + column;
                improvedError.stack = stack;
                return improvedError;
            }
        }
        return error;
    };

    var translate = System.translate;
    System.translate = function(load) {
        return translate.call(this, load).catch(function(error) {
            error = improveSyntaxError(error);
            return Promise.reject(error);
        });
    };
});
*/
