import env from 'env';
import Options from 'env/options';
import proto from 'env/proto';

import require from '@node/require';

import remap from './remap.js';

let System = env.System;

// https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js
const CoverageService = proto.extend('CoverageService', {
    env: env,
    defaultOptions: Options.create({
        urlIsPartOfCoverage: null,
        reportConsole: true,
        reportJSON: false,
        reportHTML: false,
        directory: null
    }),
    variableName: '__coverage__',
    value: undefined,

    constructor(options = {}) {
        this.options = Options.create(this.defaultOptions, options);
        this.value = {};
    },

    // must be called during env config phase, after it's too late
    install() {
        var istanbul = require('istanbul'); // we could import it

        for (var key in env.global) {
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
        var self = this;
        var translate = System.translate;
        System.translate = function(load) {
            return translate.call(this, load).then(function(transpiledSource) {
                if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                    return transpiledSource;
                }

                let loadURL = load.address;

                if (self.options.urlIsPartOfCoverage(loadURL)) {
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
        var variableName = this.variableName;
        if (variableName in env.global) {
            this.value = env.global[variableName];
        }
        return Promise.resolve(this.value);
    },

    remap: remap,

    report(coverage) {
        console.log('do something with the collected reports');

        var options = this.options;
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

        var collector = new istanbul.Collector();
        collector.add(coverage);
        var writerPromise = new Promise(function(resolve) {
            reporter.write(collector, false, resolve);
        });

        return writerPromise;
    },

    upload(coverage, authToken) {
        var moduleName = __moduleName; // eslint-disable-line
        return this.env.importDefault('./upload.js', moduleName).then(function(upload) {
            return upload(this.env, JSON.stringify(coverage), authToken);
        }.bind(this));
    }
});

export default CoverageService;
