/* global __moduleName */

import os from 'node/os';
import fs from 'node/fs';
import require from 'node/require';
import engine from 'engine';

engine.config(function provideRestart() {
    engine.restart = function() {
        process.kill(2);
    };
});

engine.config(function populatePlatform() {
    // https://nodejs.org/api/process.html#process_process_platform
    // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
    engine.platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
    engine.platform.setVersion(os.release());
});

engine.config(function populateAgent() {
    engine.agent.setName('node');
    engine.agent.setVersion(process.version.slice(1));
});

engine.config(function populateLanguage() {
    engine.language.listPreferences = function() {
        if ('lang' in process.env) {
            return process.env.lang;
        }
        return '';
    };
});

engine.config(function configLogLevel() {
    if (process.argv.indexOf('-verbose') !== -1) {
        engine.logLevel = 'error';
    }
});

engine.config(function enableStackTraceSourceMap() {
    return System.import('../../node_modules/@dmail/node-stacktrace/index.js', __moduleName).then(function(module) {
        return module.default;
    }).then(function(StackTrace) {
        var SourceMapConsumer = require('source-map').SourceMapConsumer;

        var consumers = {};
        function getSourceMapConsumer(location) {
            var consumer;

            if (location in consumers) {
                consumer = consumers[location];
            } else {
                var sourceMap = engine.sourceMaps.get(location);
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
                var fromModule = typeof process !== 'undefined' && callSites.length &&
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

        engine.exceptionHandler.throw = function(exceptionValue) {
            // we don't need this anymore thanks to Error.prepareStackTrace in @dmail/node-stacktrace
            // StackTrace.install(exceptionValue);

            // if we throw we'll get useless line saying we throwed error, thats why we use console.error
            // exceptionValue.stack;
            // throw exceptionValue;

            console.error(exceptionValue);
            process.exit(1);
        };
    });
});

engine.config(function improveSyntaxError() {
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
}).skip('not ready yet');

engine.config(function provideCoverage() {
    // https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js
    var coverage = {
        variableName: '__coverage__',
        value: {}
    };

    Object.assign(coverage, {
        // must be called during config, after it's too late
        install(options) {
            var istanbul = require('istanbul');

            for (var key in engine.global) {
                if (key.match(/\$\$cov_\d+\$\$/)) {
                    coverage.variableName = key;
                    break;
                }
            }

            // Coverage variable created by Istanbul and stored in global variables.
            // https://github.com/gotwarlost/istanbul/blob/master/lib/instrumenter.js
            var instrumenter = new istanbul.Instrumenter({
                coverageVariable: coverage.variableName
            });

            var translate = System.translate;
            System.translate = function(load) {
                return translate.call(this, load).then(function(source) {
                    if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                        return source;
                    }

                    // instead of adding this manually we'll read it from source but this is already available in the sourceMap
                    // provider so we'll reuse this logic
                    var loadUrl = engine.moduleURLs.get(load.name);

                    if (options.urlIsPartOfCoverage(loadUrl)) {
                        engine.debug('instrumenting', loadUrl, 'for coverage');

                        try {
                            return instrumenter.instrumentSync(source, loadUrl.slice(engine.baseURL.length));
                        } catch (e) {
                            var newErr = new Error(
                                'Unable to instrument "' + load.name + '" for istanbul.\n\t' + e.message
                            );
                            newErr.stack = 'Unable to instrument "' + load.name + '" for istanbul.\n\t' + e.stack;
                            newErr.originalErr = e.originalErr || e;
                            throw newErr;
                        }
                    }

                    return source;
                });
            };

            engine.run(function storeCoverageValue() {
                var variableName = coverage.variableName;
                if (variableName in engine.global) {
                    coverage.value = engine.global[variableName];
                }
                // engine.debug('raw coverage object', self.value);
            });
        },

        collect(coverage) {
            var remapIstanbul = require('remap-istanbul/lib/remap');

            var collector = remapIstanbul(coverage, {
                // this function is faking that there is a file pointing to a sourcemap when needed
                readFile: function(path) {
                    var url = engine.locate(path);
                    var source = ''; // engine.moduleSources.get(url);
                    var sourceMap = engine.sourceMaps.get(url);

                    if (sourceMap) {
                        source += '\n//# sourceMappingURL=' + path.split('/').pop() + '.map';
                    }

                    return source;
                },

                readJSON: function(path) {
                    var sourceMapFileUrl = engine.locate(path);
                    var sourceMapOwnerUrl = sourceMapFileUrl.slice(0, -'.map'.length);
                    var sourceMap = engine.sourceMaps.get(sourceMapOwnerUrl);

                    if (!sourceMap) {
                        var nodeFilePath = engine.locate(sourceMapFileUrl, true);
                        return JSON.parse(fs.readFileSync(nodeFilePath));
                    }

                    // the idea there is really to make source relative to sourceMapFileURL
                    // we need sth like engine.relative()
                    // it would also be used in instrumentSync currently hardcoded with slice(engine.baseURL.length)
                    // somthing like URL.prototype.relativeTo(otherURL)
                    var pathBase = engine.parentPath(sourceMapFileUrl);
                    sourceMap.sources = sourceMap.sources.map(function(source) {
                        if (source.startsWith(pathBase)) {
                            source = '.' + source.slice(pathBase.length);
                        }
                        return source;
                    });

                    // engine.debug('the sourcemap', sourceMap);

                    return sourceMap;
                },

                warn: function(msg) {
                    if (msg.toString().indexOf('Could not find source map for') !== -1) {
                        return;
                    }
                    console.warn(msg);
                }
            });

            return collector;
        },

        report(collector, options) {
            var istanbul = require('istanbul');

            var reporter = new istanbul.Reporter(null, options.directory);
            if (options.reportConsole) {
                reporter.add('text');
            }
            if (options.reportJSON) {
                reporter.add('json');
            }
            if (options.reportHTML) {
                reporter.add('html');
            }

            return new Promise(function(resolve) {
                reporter.write(collector, false, resolve);
            });
        }
    });

    engine.coverage = coverage;
});
