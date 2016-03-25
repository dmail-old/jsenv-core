/* eslint-env browser, node */

var StackTrace = require('@dmail/node-stacktrace');
var SourceMapConsumer = require('source-map').SourceMapConsumer;

function readSourceMapFromEngine(path) {
    path = path.replace('!transpiled', '');
    // path = System.normalize(path);

    var sources = global.engine.sources;
    var sourceMap;

    if (path in sources) {
        sourceMap = sources[path].sourceMap;
    } else {
        console.warn('no sourcemap for ' + path);
        // throw new Error('source undefined for ' + path);
    }

    return sourceMap;
}

// Maps a file path to a source map for that file
var sourceMaps = {};
function mapSourcePosition(position) {
    var sourceLocation = position.source;
    var sourceMap;

    if (sourceLocation in sourceMaps) {
        sourceMap = sourceMaps[sourceLocation];
    } else {
        // Call the (overrideable) retrieveSourceMap function to get the source map.
        var urlAndMap = readSourceMapFromEngine(sourceLocation);

        if (urlAndMap) {
            sourceMap = {
                url: urlAndMap.url,
                map: new SourceMapConsumer(urlAndMap.map)
            };

            // Load all sources stored inline with the source map into the file cache
            // to pretend like they are already loaded. They may not exist on disk.
            /*
            if (sourceMap.map.sourcesContent) {
                sourceMap.map.sources.forEach(function(source, i) {
                    var contents = sourceMap.map.sourcesContent[i];
                    if( contents ){
                        var url = supportRelativeURL(sourceMap.url, source);
                        fileContentsCache[url] = contents;
                    }
                });
            }
            */
        } else {
            sourceMap = {
                url: null,
                map: null
            };
        }

        sourceMaps[sourceLocation] = sourceMap;
    }

    console.log('do we have a sourcemap for', sourceLocation, Boolean(sourceMap.map));

    var map = sourceMap.map;
    // Resolve the source URL relative to the URL of the source map
    if (map) {
        var originalPosition = map.originalPositionFor(position);

        // Only return the original position if a matching line was found. If no
        // matching line is found then we return position instead, which will cause
        // the stack trace to print the path and line for the compiled file. It is
        // better to give a precise location in the compiled file than a vague
        // location in the original file.
        if (originalPosition.source !== null) {
            originalPosition.source = new URL(sourceMap.url || sourceLocation, originalPosition.source).toString();
            return originalPosition;
        }
    }

    return position;
}

function mapCallSite(callSite, index, callSites) {
    var source = callSite.getScriptNameOrSourceURL() || callSite.getFileName();

    console.log('mapping callsite located at', source);

    if (source) {
        var line = callSite.getLineNumber();
        var column = callSite.getColumnNumber() - 1;

        // Fix position in Node where some (internal) code is prepended.
        // See https://github.com/evanw/node-source-map-support/issues/36
        var fromModule = typeof process !== 'undefined' && callSites.length &&
        callSites[callSites.length - 1].getFileName() === 'module.js';
        if (fromModule && line === 1) {
            column -= 63;
        }

        var position = mapSourcePosition({
            source: source,
            line: line,
            column: column
        });

        callSite.source = position.source;
        callSite.lineNumber = position.line;
        callSite.columnNumber = position.column + 1;
    }

    /*
    if( callSite.isEval() ){
        console.log('handling isEval calls');

        var evalOrigin = callSite.getEvalOrigin();
        var evalSsource = evalOrigin.getFileName() || evalOrigin.getScriptNameOrSourceURL();
        var evalLine = evalOrigin.getLineNumber();
        var evalColumn = evalOrigin.getColumnNumber() - 1;

        var evalPosition =  mapSourcePosition({
            source: source,
            line: evalSsource,
            column: evalColumn
        });

        callSite.evalFileName = evalPosition.source;
        callSite.evalLineNumber = evalPosition.line;
        callSite.evalColumnNumber = evalPosition.column + 1;
    }
    */

    // Code called using eval() needs special handling
    /*
    if( callSite.isEval() ){
        var evalOrigin = callSite.getEvalOrigin();

        if( evalOrigin ){
            mapCallSite(evalOrigin);
        }
    }
    */

    // console.log('mapping', source, 'into', callSite.source);
}

StackTrace.setTransformer(mapCallSite);

/*
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
*/
