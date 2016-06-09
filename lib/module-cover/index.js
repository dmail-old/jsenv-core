import env from 'env';

import require from '@node/require';

import remap from './remap.js';

let System = env.System;

// https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js
let coverPlugin = {
    name: 'cover',
    defaultOptions: {
        globalName: '__coverage__',
        isPartOfCoverage: 'auto',
        report: {
            console: {
                enabled: true
            },
            directory: 'auto',
            json: {
                enabled: false
            },
            html: {
                enabled: false
            }
        },
        upload: {
            codecov: {
                enabled: false,
                token: ''
            }
        }
    },
    value: {},

    install(options) {
        // this will mvoe to evalMain cause we'll need this in other places
        var mainURI = env.createURI(env.mainModule.href);
        env.mainURI = mainURI;

        if (options.isPartOfCoverage === 'auto') {
            // most time we do code coverage test to see how a file is covering all it's dependencies
            // so checking that the file is the mainLocation or a peer or inside is sufficient
            options.isPartOfCoverage = function(load) {
                return env.mainURI.includes(load.address);
            };
        }

        env.run(function() {
            return coverPlugin.collect().then(function(coverage) {
                return coverPlugin.remap(coverage);
            }).then(function(remappedCoverage) {
                coverPlugin.value = remappedCoverage;
                return remappedCoverage;
            });
        });

        var reportOptions = options.report;
        if (reportOptions) {
            var reportConsole = reportOptions.console && reportOptions.console.enabled;
            var json = reportOptions.json && reportOptions.json.enabled;
            var html = reportOptions.html && reportOptions.html.enabled;

            if (reportConsole || json || html) {
                if (reportOptions.directory === 'auto') {
                    var mainURIClone = env.mainURI.clone();
                    mainURIClone.protocol = ''; // remove the file:/// protocol on node
                    mainURIClone.suffix = '';
                    mainURIClone.filename += '-coverage';

                    console.log('report directory :', mainURIClone.href);

                    reportOptions.directory = mainURIClone.href;
                }

                env.run(function() {
                    return coverPlugin.report(coverPlugin.value, reportOptions);
                });
            }
        }

        var uploadOptions = options.upload;
        if (uploadOptions) {
            var codecov = uploadOptions.codecov;
            if (codecov && codecov.enabled) {
                if (process.env.CODECOV_TOKEN && !codecov.token) {
                    codecov.token = process.env.CODECOV_TOKEN;
                }

                env.run(function() {
                    return coverPlugin.upload(coverPlugin.value, uploadOptions);
                });
            }
        }

        return this.installTranspileHook();
    },

    // must be called during env config phase, after it's too late
    installTranspileHook() {
        var istanbul = require('istanbul'); // we could import it

        for (var key in env.global) {
            if (key.match(/\$\$cov_\d+\$\$/)) {
                this.options.globalName = key;
                break;
            }
        }

        // Coverage variable created by Istanbul and stored in global variables.
        // https://github.com/gotwarlost/istanbul/blob/master/lib/instrumenter.js
        var instrumenter = new istanbul.Instrumenter({
            coverageVariable: this.options.globalName
        });

        console.log('installing coverage translate hook');
        var self = this;
        var translate = System.translate;
        System.translate = function(load) {
            return translate.call(this, load).then(function(transpiledSource) {
                if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                    return transpiledSource;
                }

                let loadURL = load.address;

                if (self.options.isPartOfCoverage(load)) {
                    env.debug('instrumenting', loadURL, 'for coverage');

                    try {
                        var sourceURL;
                        if (loadURL.indexOf('file:///') === 0) {
                            sourceURL = loadURL.slice('file:///'.length);
                        } else {
                            sourceURL = loadURL;
                        }
                        // var relativeUrl = env.baseURI.relative(loadURL);
                        // loadURL i lfaut lui enelever le file:///
                        var sourcePath = sourceURL + '!transpiled'; // hardcoded for now but should be added only if there is a sourcemap on transpiledSource
                        // console.log('relative url', relativeUrl);

                        // https://github.com/estools/escodegen/wiki/Source-Map-Usage
                        instrumenter.opts.codeGenerationOptions = {
                            sourceMap: sourcePath, // il faut passer le fichier d'origine, sauf que ce fichier n'est pas dispo sur le fs puisque transpiled
                            sourceContent: transpiledSource,
                            sourceMapWithCode: true,
                            file: sourcePath
                        };
                        //
                        // tod: put this to true if the instrumented module is anonymous
                        // a way to know if the module is register anonymously doing System.module is to check if it's adress looks like
                        // '<Anonymous Module ' + ++anonCnt + '>';
                        // https://github.com/ModuleLoader/es6-module-loader/issues/489
                        // but if the anonymous module provide an adresse you're fucked and if a normal module use <Anonymous Module 1>
                        // you would register it by mistake
                        // for now we will enable embedSource if the load.address includes anonymous somewhere
                        if (sourcePath.includes('anonymous')) {
                            instrumenter.opts.embedSource = true;
                        } else {
                            instrumenter.opts.embedSource = false;
                        }

                        // https://github.com/karma-runner/karma-coverage/pull/146/files

                        var instrumentedSource = instrumenter.instrumentSync(transpiledSource, sourcePath);
                        var instrumentedSourceMap = instrumenter.lastSourceMap().toString();

                        // I suppose it's a way to merge sourcemap into one
                        // var consumer = new SourceMap.SourceMapConsumer(instrumentedSourceMap);
                        // var generator = SourceMap.SourceMapGenerator.fromSourceMap(consumer);
                        // generator.applySourceMap(new SourceMap.SourceMapConsumer(file.sourceMap));
                        // var finalSourceMap = generator.toString();

                        // console.log('the sourcemap', instrumentedSourceMap);
                        // btoa(unescape(encodeURIComponent(sourceMap)));
                        var base64SourceMap = new Buffer(instrumentedSourceMap).toString('base64');
                        var base64Data = 'data:application/json;base64,' + base64SourceMap;

                        // we concat the sourceURL & sourceMappingURL to prevent parse to believe they are the sourceURL
                        // & sourcemap of this file
                        // eslint-disable-next-line no-useless-concat
                        instrumentedSource += '\n//# source' + 'URL=' + load.address + '!instrumented';
                        // eslint-disable-next-line no-useless-concat
                        instrumentedSource += '\n//# source' + 'MappingURL=' + base64Data;

                        env.sources.set(load.address, instrumentedSource);

                        return instrumentedSource;
                    } catch (e) {
                        var newErr = new Error(
                            'Unable to instrument "' + load.address + '" for istanbul.\n\t' + e.message
                        );
                        newErr.stack = 'Unable to instrument "' + load.name + '" for istanbul.\n\t' + e.stack;
                        newErr.originalErr = e.originalErr || e;
                        throw newErr;
                    }
                }

                return transpiledSource;
            });
        };

        // console.log('register sore-coverage-value action');
        // env.run('store-coverage-value', function() {
        //     this.collect();
        // }.bind(this));
    },

    collect() {
        var globalName = this.options.globalName;
        if (globalName in env.global) {
            this.value = env.global[globalName];
        }
        return Promise.resolve(this.value);
    },

    remap: remap,

    report(coverage, reportOptions) {
        // console.log('do something with the collected reports', coverage);

        var istanbul = require('istanbul');

        var reporter = new istanbul.Reporter(null, reportOptions.directory);
        if (reportOptions.console.enabled) {
            reporter.add('text');
        }
        if (reportOptions.json.enabled) {
            reporter.add('json');
        }
        if (reportOptions.html.enabled) {
            reporter.add('html');
        }

        var collector = new istanbul.Collector();
        collector.add(coverage);
        var writerPromise = new Promise(function(resolve) {
            reporter.write(collector, false, resolve);
        });

        return writerPromise;
    },

    upload(coverage, uploadOptions) {
        if (uploadOptions.codecov.enabled) {
            var moduleName = __moduleName; // eslint-disable-line
            return env.importDefault('./upload.js', moduleName).then(function(upload) {
                return upload(env, JSON.stringify(coverage), uploadOptions.codecov.token);
            });
        }
    }
};

export default coverPlugin;
