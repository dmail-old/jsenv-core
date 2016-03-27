/* global __moduleName  */

import os from 'node/os';
import fs from 'node/fs';
import engine from 'engine';

import StackTrace from '../node_modules/@dmail/node-stacktrace/index.js';

engine.restart = function() {
    process.kill(2);
};

// https://nodejs.org/api/process.html#process_process_platform
// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
engine.platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
engine.platform.setVersion(os.release());

engine.agent.setName('node');
engine.agent.setVersion(process.version.slice(1));

engine.language.listPreferences = function() {
    if ('lang' in process.env) {
        return process.env.lang;
    }
    return '';
};

// error stack sourcemap support on nodejs
(function() {
    var SourceMapConsumer = global.nodeRequire('source-map').SourceMapConsumer;

    // Maps a file path to a source map for that file
    var sourceMaps = {};
    function mapSourcePosition(position) {
        var sourceLocation = position.source;
        var sourceMap;

        if (sourceLocation in sourceMaps) {
            sourceMap = sourceMaps[sourceLocation];
        } else {
            sourceMap = engine.getSourceMap(sourceLocation);

            if (sourceMap) {
                sourceMap = {
                    url: sourceMap.url,
                    map: new SourceMapConsumer(sourceMap.map)
                };
            } else {
                sourceMap = {
                    url: null,
                    map: null
                };
            }

            sourceMaps[sourceLocation] = sourceMap;
        }

        // Resolve the source URL relative to the URL of the source map
        if (sourceMap.map) {
            var originalPosition = sourceMap.map.originalPositionFor(position);

            // Only return the original position if a matching line was found. If no
            // matching line is found then we return position instead, which will cause
            // the stack trace to print the path and line for the compiled file. It is
            // better to give a precise location in the compiled file than a vague
            // location in the original file.
            if (originalPosition.source !== null) {
                originalPosition.source = engine.locateFrom(
                    sourceMap.url || sourceLocation,
                    originalPosition.source
                );
                return originalPosition;
            }
        }

        return position;
    }

    function transformCallSite(callSite, index, callSites) {
        var source = callSite.getScriptNameOrSourceURL() || callSite.getFileName();

        if (source && source !== __moduleName) {
            var line = callSite.getLineNumber();
            var column = callSite.getColumnNumber() - 1;

            // Fix position in Node where some (internal) code is prepended.
            // See https://github.com/evanw/node-source-map-support/issues/36
            var fromModule = typeof process !== 'undefined' && callSites.length &&
            callSites[callSites.length - 1].getFileName() === 'module.js';
            if (fromModule && line === 1) {
                column -= 63;
            }
            // not very clean because it's hardcoded while we could read it from # sourceURL comments
            source = source.replace(/!transpiled$/, '');

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

    StackTrace.setTransformer(transformCallSite);

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

    // we have to define the throw method else stack trace is not correctly printed
    engine.throw = function(exceptionValue) {
        // we don't need this anymore thanks to Error.prepareStackTrace in @dmail/node-stacktrace
        // StackTrace.install(exceptionValue);

        // if we throw we'll get a line saying we throwed error, useless, thats why we use console.error
        // exceptionValue.stack;
        // throw exceptionValue;

        console.error(exceptionValue);
        process.exit(1);
    };
})();

// coverage support
(function() {
    engine.config(function coverage() {
        // https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js

        if (!engine.isProcess()) {
            return;
        }

        // donc l'idée là c'est de proposer le coverage
        if (engine.enableCoverage) {

        }

        function enableCoverage() {
            var istanbul = global.nodeRequire('istanbul');
            var istanbulGlobal;
            for (var key in global) {
                if (key.match(/\$\$cov_\d+\$\$/)) {
                    istanbulGlobal = key;
                    break;
                }
            }
            istanbulGlobal = istanbulGlobal || '__coverage__';

            // Coverage variable created by Istanbul and stored in global variables.
            // https://github.com/gotwarlost/istanbul/blob/master/lib/instrumenter.js
            var instrumenter = new istanbul.Instrumenter({
                coverageVariable: istanbulGlobal
            });

            var translate = System.translate;
            System.translate = function(load) {
                return translate.call(this, load).then(function(source) {
                    if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                        return source;
                    }

                    try {
                        return instrumenter.instrumentSync(source, load.address.substr(System.baseURL.length));
                    } catch (e) {
                        var newErr = new Error(
                            'Unable to instrument "' + load.name + '" for istanbul.\n\t' + e.message
                        );
                        newErr.stack = 'Unable to instrument "' + load.name + '" for istanbul.\n\t' + e.stack;
                        newErr.originalErr = e.originalErr || e;
                        throw newErr;
                    }
                });
            };

            engine.coverageGlobalVariable = istanbulGlobal;
        }

        function report(coverageType) {
            var remapIstanbul = global.nodeRequire('remap-istanbul/lib/remap');

            coverageType = coverageType || 'text';
            var coverage = engine.global[engine.coverageGlobalVariable];
            coverage = coverage || {};

            var collector = remapIstanbul(coverage, {
                readFile: function(path) {
                    console.log('read file at', path);

                    var originalSourceObject = engine.sources[System.baseURL + path];
                    var source = originalSourceObject.source;

                    return source;
                },

                readJSON: function(path) {
                    path = path.replace(/\\/g, '/');

                    var pathBase = System.baseURL + path.split('/').slice(0, -1).join('/');
                    var modulePath = System.baseURL + path.substr(0, path.length - 4);
                    var originalSourcesObj = engine.sources[modulePath];

                    // console.log('pathbase', pathBase);
                    console.log('read json for', modulePath, 'got original source?', Boolean(originalSourcesObj));

                    // we may not have any sourcemap because file does not requires any?

                    // non transpilation-created source map -> load the source map file directly
                    if (!originalSourcesObj || !originalSourcesObj.sourceMap) {
                        console.log('we dont have any sourcemap, parse json at', System.baseURL + path);

                        return JSON.parse(fs.readFileSync(System.baseURL + path));
                    }

                    var sourceMap = originalSourcesObj.sourceMap;
                    if (typeof sourceMap === 'string') {
                        sourceMap = JSON.parse(sourceMap);
                    }

                    console.log('got sourcemap correctly');

                    sourceMap.sources = sourceMap.sources.map(function(src) {
                        if (src.substr(0, pathBase.length) === pathBase) {
                            src = './' + src.substr(pathBase.length);
                        }
                        return src;
                    });

                    return sourceMap;
                },

                warn: function(msg) {
                    if (msg.toString().indexOf('Could not find source map for') !== -1) {
                        return;
                    }
                    console.warn(msg);
                }
            });

            var fileData = [];
            var fileName;
            var writer = {
                on: function(evt, fn) {
                    if (evt === 'done') {
                        this.done = fn;
                    }
                },

                writeFile: function(name, write) {
                    console.log('writing file', name);

                    fileName = fileName || name;
                    if (fileName !== name) {
                        throw new Error('Multiple file outputs not currently supported.');
                    }
                    var contentWriter = {
                        println: function(line) {
                            // console.log('writing line', line);
                            fileData.push(line + '\n');
                        },

                        write: function(data) {
                            // console.log('writing', data);
                            fileData.push(data);
                        }
                    };
                    write(contentWriter);
                },

                done: function() {
                    this.done();
                }
            };

            var cfg = {
                reporting: {
                    reportConfig: function() {
                        var reportConfig = {

                        };
                        reportConfig[coverageType] = {
                            writer: writer
                        };
                        return reportConfig;
                    },

                    watermarks: function() {

                    }
                }
            };

            var reporter = new istanbul.Reporter(cfg, __dirname + '/myown-coverage'); // eslint-disable-line
            // reporter.add('lcovonly');
            reporter.add('html');
            reporter.add(coverageType);

            return new Promise(function(resolve) {
                console.log('writing report from collected data');
                reporter.write(collector, false, resolve);
            }).then(function() {
                return fileData.join('');
            }).then(function(output) {
                fs.writeFileSync('coverage.json', output);
            });
        }

        return {
            enableCoverage: enableCoverage,
            report: report
        };
    });
})();
