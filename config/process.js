/* global __moduleName, URL */

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
    return System.import('../node_modules/@dmail/node-stacktrace/index.js', __moduleName).then(function(module) {
        return module.default;
    }).then(function(StackTrace) {
        var SourceMapConsumer = require('source-map').SourceMapConsumer;

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

        // var improveSyntaxError = function(error) {
        //     if (error && error.name === 'SyntaxError' && error._babel) {
                   // error.loc contains {line: 0, column: 0}
        //         var match = error.message.match(/([\s\S]+): Unterminated string constant \(([0-9]+)\:([0-9]+)/);
        //         if (match) {
        //             var improvedError = new SyntaxError();
        //             var column = match[3];
        //             column += 63; // because node-sourcemap/index.js:155 will do column-=63
        //             var stack = '';
        //             stack += 'SyntaxError: Unterminated string constant\n\t at ';
        //             stack += match[1] + ':' + match[2] + ':' + column;
        //             improvedError.stack = stack;
        //             return improvedError;
        //         }
        //     }
        //     return error;
        // };

        // var translate = System.translate;
        // System.translate = function(load) {
        //     return translate.call(this, load).catch(function(error) {
        //         error = improveSyntaxError(error);
        //         return Promise.reject(error);
        //     });
        // };

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
        engine.exceptionHandler.throw = function(exceptionValue) {
            // we don't need this anymore thanks to Error.prepareStackTrace in @dmail/node-stacktrace
            // StackTrace.install(exceptionValue);

            // if we throw we'll get a line saying we throwed error, useless, thats why we use console.error
            // exceptionValue.stack;
            // throw exceptionValue;

            console.error(exceptionValue);
            process.exit(1);
        };
    });
});

engine.config(function provideCoverage() {
    // https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js

    function stripTrailingSep(pathname) {
        if (pathname[pathname.length - 1] === '/') {
            pathname = pathname.slice(0, -1);
        }
        return pathname;
    }

    function urlIsSiblingOrDescendantOf(url, otherUrl) {
        url = new URL(url, otherUrl);
        otherUrl = new URL(otherUrl);

        if (url.protocol !== otherUrl.protocol) {
            return false;
        }
        if (url.host !== otherUrl.host) {
            return false;
        }
        if (url.port !== otherUrl.port) {
            return false;
        }

        var pathname = stripTrailingSep(url.pathname);
        var potentialParentOrSibling = stripTrailingSep(otherUrl.pathname);
        var potentialDirname = potentialParentOrSibling.slice(0, potentialParentOrSibling.lastIndexOf('/'));

        return pathname.startsWith(potentialDirname);
    }

    var coverage = {
        variableName: '__coverage__',
        value: {},

        urlIsPartOfCoverage(url) {
            // the url must be a sibling or a descendant of engine.mainLocation
            return urlIsSiblingOrDescendantOf(url, engine.mainLocation);
        },

        // must be called during config, after it's too late
        enable() {
            var istanbul = require('istanbul');

            for (var key in engine.global) {
                if (key.match(/\$\$cov_\d+\$\$/)) {
                    this.variableName = key;
                    break;
                }
            }

            // Coverage variable created by Istanbul and stored in global variables.
            // https://github.com/gotwarlost/istanbul/blob/master/lib/instrumenter.js
            var instrumenter = new istanbul.Instrumenter({
                coverageVariable: this.variableName
            });

            var translate = System.translate;
            var self = this;
            System.translate = function(load) {
                return translate.call(this, load).then(function(source) {
                    if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                        return source;
                    }

                    if (self.urlIsPartOfCoverage(load.address)) {
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
                    }

                    return source;
                });
            };

            return new Promise(function(resolve) {
                engine.run(function() {
                    // when engine is ready set the coverage object
                    if (self.variableName in engine.global) {
                        self.value = self.variableName;
                    }
                    resolve(self.value);
                });
            });
        },

        collect() {
            var remapIstanbul = require('remap-istanbul/lib/remap');

            var collector = remapIstanbul(coverage, {
                readFile: function(path) {
                    var originalSourceObject = engine.sources[System.baseURL + path];
                    var source = originalSourceObject.source;

                    // I've to add this even if useless because it's how remapIstanbul knows there is a sourceMap for this file
                    if ('sourceMap' in originalSourceObject) {
                        source += '\n//# sourceMappingURL=' + path.split('/').pop() + '.map';
                    }

                    // console.log('read file at', path, source);

                    return source;
                },

                readJSON: function(path) {
                    console.log('reading json at', path);

                    path = path.replace(/\\/g, '/');

                    var pathBase = System.baseURL + path.split('/').slice(0, -1).join('/');
                    var modulePath = System.baseURL + path.substr(0, path.length - 4);
                    var originalSourcesObj = engine.sources[modulePath];

                    // console.log('pathbase', pathBase);
                    // console.log('read json for', modulePath, 'got original source?', Boolean(originalSourcesObj));

                    // we may not have any sourcemap because file does not requires any?

                    // non transpilation-created source map -> load the source map file directly
                    if (!originalSourcesObj || !originalSourcesObj.sourceMap) {
                        console.log('we dont have any sourcemap, parse json at', System.baseURL + path);

                        return JSON.parse(fs.readFileSync(System.baseURL + path));
                    }

                    var map = originalSourcesObj.sourceMap.map;

                    // console.log('got sourcemap correctly', map);

                    map.sources = map.sources.map(function(src) {
                        if (src.substr(0, pathBase.length) === pathBase) {
                            src = './' + src.substr(pathBase.length);
                        }
                        return src;
                    });

                    return map;
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

        report() {
            var collector = this.collect();
            var mainLocation = engine.mainLocation;
            var coverageDir = engine.locateFrom('error-coverage', mainLocation, true);

            var reportConsole = true;
            var reportJSON = true;
            var reportHTML = true;
            var reporter = new istanbul.Reporter(null, coverageDir); // eslint-disable-line
            if (reportConsole) {
                reporter.add('text');
            }
            if (reportJSON) {
                reporter.add('json');
            }
            if (reportHTML) {
                reporter.add('html');
            }

            return new Promise(function(resolve) {
                reporter.write(collector, false, resolve);
            });
        }
    };

    engine.coverage = coverage;
});

engine.config(function configCoverage() {
    // most time we do code coverage test to see how a file is covering all it's dependencies
    // so checking that the file is the mainLocation or a peer or inside is sufficient
    // engine.coverage.enable().then(engine.coverage.report);
});
