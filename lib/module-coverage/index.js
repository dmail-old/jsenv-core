import jsenv from 'jsenv';
import Options from 'jsenv/options';

import fs from '@node/fs';
import path from '@node/path';
import require from '@node/require';

const moduleScriptNames = jsenv.importMetas.scriptNames;
const moduleSourceMaps = jsenv.importMetas.sourceMaps;

// https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js
let coverageService = {
    defaultOptions: {
        urlIsPartOfCoverage: null,
        reportConsole: true,
        reportJSON: false,
        reportHTML: false,
        directory: null
    },

    variableName: '__coverage__',
    value: {},

    // must be called during config, after it's too late
    install(options) {
        var istanbul = require('istanbul');

        for (var key in jsenv.global) {
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

        console.log('installing coverage translate hook');
        var translate = System.translate;
        System.translate = function(load) {
            return translate.call(this, load).then(function(source) {
                if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                    return source;
                }

                // instead of adding this manually we'll read it from source but this is already available in the sourceMap
                // provider so we'll reuse this logic
                var loadUrl = moduleScriptNames.get(load.name);

                if (options.urlIsPartOfCoverage(loadUrl)) {
                    jsenv.debug('instrumenting', loadUrl, 'for coverage');

                    try {
                        var relativeUrl = jsenv.baseURI.relative(loadUrl);
                        console.log('relative url', relativeUrl);

                        return instrumenter.instrumentSync(source, relativeUrl);
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

        console.log('register sore-coverage-value action');
        jsenv.run('store-coverage-value', function() {
            var variableName = this.variableName;
            if (variableName in jsenv.global) {
                this.value = jsenv.global[variableName];
            }
            // engine.debug('raw coverage object', self.value);
        }.bind(this));
    },

    collect(coverageResult) {
        var remapIstanbul = require('remap-istanbul/lib/remap');

        var collector = remapIstanbul(coverageResult, {
            // this function is faking that there is a file pointing to a sourcemap when needed
            readFile: function(path) {
                var url = jsenv.locate(path);
                var source = ''; // engine.moduleSources.get(url);
                var sourceMap = moduleSourceMaps.get(url);

                console.log('simulate that', url, 'got source file at', path.split('/').pop() + '.map');

                if (sourceMap) {
                    source += '\n//# sourceMappingURL=' + path.split('/').pop() + '.map';
                }

                return source;
            },

            readJSON: function(path) {
                console.log('read json', path);
                var sourceMapFileURI = jsenv.baseURI.resolve(path);
                var sourceMapOwnerURI = sourceMapFileURI.clone();
                sourceMapOwnerURI.suffix = ''; // remove .map suffix
                var sourceMap = moduleSourceMaps.get(sourceMapOwnerURI.href);

                if (!sourceMap) {
                    var nodeFileURI = sourceMapFileURI.clone();
                    if (nodeFileURI.protocol === 'file') { // remove file:// protocol for node
                        nodeFileURI.protocol = '';
                    }

                    return JSON.parse(fs.readFileSync(nodeFileURI.href));
                }

                // make source relativeTo sourceMapFileURI
                sourceMap.sources = sourceMap.sources.map(function(source) {
                    var relativeSource = sourceMapFileURI.relative(source);
                    console.log('source', source, 'relativized to', relativeSource);
                    return relativeSource;
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
        console.log('do something with the collected reports');

        var istanbul = require('istanbul');

        var reporter = new istanbul.Reporter(null, options.directory);
        if (options.console) {
            reporter.add('text');
        }
        if (options.json) {
            reporter.add('json');
        }
        if (options.html) {
            reporter.add('html');
        }
        // force json file when sending to codecov
        if (options.codecov) {
            reporter.add('json');
        }

        var writerPromise = new Promise(function(resolve) {
            reporter.write(collector, false, resolve);
        });

        // for now we'll just get the file named coverage-final.json and pass it to codecov.io
        // but we could get the JSON as a string and avoid to involve filesystem
        if (options.codecov) {
            var useCustom = true;

            writerPromise = writerPromise.then(function() {
                var jsonPath = path.resolve(options.directory, 'coverage-final.json');
                return fs.readFileSync(jsonPath).toString('utf8');
            }).then(function(jsonString) {
                if (useCustom) {
                    var moduleName = __moduleName; // eslint-disable-line
                    return System.import('./upload.js', moduleName).then(function(module) {
                        return module.default;
                    }).then(function(upload) {
                        return upload(jsonString, options.codecov.token);
                    });
                }

                process.env.CODECOV_TOKEN = options.codecov.token;
                return new Promise(function(resolve, reject) {
                    require('codecov.io').handleInput(jsonString, function(error) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
            });
        }

        return writerPromise;
    },

    cover(options) {
        var customOptions = Options.create(this.defaultOptions, options);

        coverageService.install(customOptions);

        console.log('register module-coverage-report action');
        jsenv.run('module-coverage-report', function() {
            var collector = coverageService.collect(coverageService.value);

            return coverageService.report(collector, customOptions);
        });
    }
};

export default coverageService;
