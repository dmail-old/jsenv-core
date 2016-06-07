import Options from 'env/options';
import proto from 'env/proto';

import fs from '@node/fs';
import path from '@node/path';
import require from '@node/require';

import remap from './remap.js';

// import SourceMap from 'source-map';

// https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js
const CoverageService = proto.extend('CoverageService', {
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
    install(env) {
        this.env = env;

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
        var translate = env.System.translate;
        env.System.translate = function(load) {
            return translate.call(this, load).then(function(transpiledSource) {
                if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                    return transpiledSource;
                }

                let loadURL = load.address;

                if (self.options.urlIsPartOfCoverage(loadURL)) {
                    env.debug('instrumenting', loadURL, 'for coverage');

                    try {
                        var relativeUrl = env.baseURI.relative(loadURL);
                        var relativeSourceName = relativeUrl + '!transpiled'; // hardcoded for now but should be added only if there is a sourcemap on transpiledSource
                        // console.log('relative url', relativeUrl);

                        // https://github.com/estools/escodegen/wiki/Source-Map-Usage
                        instrumenter.opts.codeGenerationOptions = {
                            sourceMap: relativeSourceName, // il faut passer le fichier d'origine, sauf que ce fichier n'est pas dispo sur le fs puisque transpiled
                            sourceContent: transpiledSource,
                            sourceMapWithCode: true,
                            file: relativeSourceName
                        };
                        // instrumenter.opts.embedSource = true;
                        // tod: put this to true if the instrumented module is anonymous
                        // a way to know if the module is register anonymously doing System.module is to check if it's adress looks like
                        // '<Anonymous Module ' + ++anonCnt + '>';
                        // https://github.com/ModuleLoader/es6-module-loader/issues/489
                        // but if the anonymous module provide an adresse you're fucked and if a normal module use <Anonymous Module 1>
                        // you would register it by mistake
                        // for now we will enable embedSource if the load.address includes anonymous somewhere

                        // https://github.com/karma-runner/karma-coverage/pull/146/files

                        var instrumentedSource = instrumenter.instrumentSync(transpiledSource, relativeSourceName);
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
        if (variableName in this.env.global) {
            this.value = this.env.global[variableName];
        }
        return this.value;
    },

    /*
    collect(coverageResult) {
        var remapIstanbul = require('remap-istanbul/lib/remap');

        // before doing this we have to preload ALL sourcemap because remapIstanbul expect to read sourcemap async
        // or load only thoose found in thecoverageResult, anyway I have to update this

        // I suppose I'll have to rewrite remapIstanbul to allow async remapping
        // maybe I could avoid this for now and just let instanbull use the base64 sourcemap for now

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
    */

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

    remap: remap,

    cover() {
        this.install();

        console.log('register module-coverage-report action');
        this.env.run('module-coverage-report', function() {
            return this.collect().then(function(collector) {
                return this.report(collector);
            }.bind(this));
        }.bind(this));
    }
});

export default CoverageService;
