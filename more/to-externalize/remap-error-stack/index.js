// detect if source-map are supported somewhere and load this is they are not

import jsenv from 'jsenv';

// import exceptionHandler from 'jsenv/exception-handler';
import StackTrace from 'env/stacktrace';
// import FileSource from 'jsenv/file-source';
// import fetchAsText from 'env/fetch-as-text';

let exceptionHandler = jsenv.exceptionHandler;
let sources = jsenv.sources;

function transformCallSite(callSite, index, callSites) {
    if (index === 0) {
        callSite.showSource = true;
    }

    callSite.prepare = function() {
        // le callSite possède une location soit on possède déjà le fichier source à cette url
        // soit on ne l'a pas dans tous les cas on crée un objet source depuis l'url
        // puis on fait un import
        // puis on crée un sourcemap consumer pour récup des infos

        var sourceLocation = callSite.getScriptNameOrSourceURL() || callSite.getFileName();

        if (sourceLocation) {
            sourceLocation = jsenv.cleanPath(sourceLocation);

            var line = callSite.getLineNumber();
            var column = callSite.getColumnNumber() - 1;

            // Fix position in Node where some (internal) code is prepended.
            // See https://github.com/evanw/node-source-map-support/issues/36
            var fromModule = jsenv.isNode() && callSites.length &&
            callSites[callSites.length - 1].getFileName() === 'module.js';
            if (fromModule && line === 1) {
                column -= 63;
            }

            // do not try to read node source files, I don't know where they are
            if (jsenv.isNode() && sourceLocation.indexOf('/') === -1) {
                return;
            }

            var fileSource = sources.get(sourceLocation);

            // console.log('preparing', sourceLocation, line, column);

            return fileSource.prepare().then(function() {
                callSite.fileSource = fileSource.getOriginalSource();

                var position = {
                    line: line,
                    column: column
                };
                var originalPosition = fileSource.getOriginalPosition(position);

                // Only update the position if a matching line was found. If no
                // matching line is found then we return position instead, which will cause
                // the stack trace to print the path and line for the compiled file. It is
                // better to give a precise location in the compiled file than a vague
                // location in the original file.
                if (originalPosition && originalPosition.source) {
                    callSite.source = originalPosition.source;
                    callSite.lineNumber = originalPosition.line;
                    callSite.columnNumber = originalPosition.column + 1;
                } else {
                    return System.import('@node/fs').then(function(fs) {
                        console.log(
                            'cannot find original position for',
                            fileSource.url,
                            'at',
                            position,
                            'writing file suffixed with -es5 for debug'
                        );
                        fs.writeFileSync(fileSource.url.slice('file:///'.length) + '-es5.js', fileSource.content);
                    });
                }
            });
        }
    };

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

exceptionHandler.add(function(exceptionValue) {
    if (exceptionValue instanceof Error) {
        return StackTrace.install(exceptionValue).prepare().then(
            function() {
                // once stack is prepared we can reject the exception
                return Promise.reject(exceptionValue);
            },
            function(error) {
                // if an error ocurred while preparing the stack (loading sourcemap, etc)
                // just reject the error and log this error
                console.error('an error occured while preparing stack', error);
                return Promise.reject(exceptionValue);
            }
        );
    }
    return Promise.reject(exceptionValue);
});

exceptionHandler.throw = function(exceptionValue) {
    // StackTrace.install(exceptionValue); // we don't need this anymore thanks to Error.prepareStackTrace in @dmail/node-stacktrace

    // if we throw we'll get useless line saying we throwed error, thats why we use console.error
    // exceptionValue.stack;
    // throw exceptionValue;

    console.error(exceptionValue);
    process.exit(1);
};

// jsenv.defineSupportDetector('error-stack-sourcemap', function() {
//         if (this.isNode()) {
//             return false;
//         }
//         if (this.isBrowser()) {
//             if (this.agent.name === 'chrome') {
//                 return true;
//             }
//             return false;
//         }
//         return false;
//     });

//     if (jsenv.support('error-stack-sourcemap') === false) {
//         installPromise = installPromise.then(function() {
//             return jsenv.import('env/remap-error-stack');
//         });
//     }

/*
// we must make this cross platform or it's pretty useless
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
