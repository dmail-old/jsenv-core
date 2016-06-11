/* globals __moduleName */

import env from 'env';

import require from '@node/require';

import instrument from './instrument.js';

let System = env.System;

let coverer = {
    options: {
        coverage: 'auto',
        globalName: 'auto',
        isPartOfCoverage: 'auto',
        remap: true
    },

    cover(options) {
        if (options.coverage === 'auto') {
            if (options.isPartOfCoverage === 'auto') {
                // most time we do code coverage test to see how a file is covering all it's dependencies
                // so checking that the file is the mainLocation or a peer or inside is sufficient
                options.isPartOfCoverage = function(load) {
                    return env.mainURI.includes(load.address);
                };
            }

            if (options.globalName === 'auto') {
                // Coverage variable created by Istanbul and stored in global variables.
                // https://github.com/gotwarlost/istanbul/blob/master/lib/instrumenter.js
                var currentGlobalName;
                for (var key in env.global) {
                    if (key.match(/\$\$cov_\d+\$\$/)) {
                        currentGlobalName = key;
                        break;
                    }
                }
                options.globalName = currentGlobalName || '__coverage__';
            }

            // console.log('installing coverage translate hook');
            var translate = System.translate;
            System.translate = function(load) {
                return translate.call(this, load).then(function(transpiledSource) {
                    if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
                        return transpiledSource;
                    }

                    if (options.isPartOfCoverage(load)) {
                        let loadURL = load.address;
                        env.debug('instrumenting', loadURL, 'for coverage');

                        try {
                            var instrumentedSource = instrument(options.globalName, loadURL, transpiledSource);
                            env.sources.set(loadURL, instrumentedSource);
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
            env.run(function() {
                var coverage;
                var globalName = options.globalName;
                if (globalName in env.global) {
                    coverage = env.global[globalName];
                }

                if (options.remap) {
                    var remappedCoveragePromise = env.importDefault('./remap.js', __moduleName).then(function(remap) {
                        return remap(coverage);
                    });
                    options.coveragePromise.resolve(remappedCoveragePromise);
                    return remappedCoveragePromise;
                }
                options.coveragePromise.resolve(coverage);
            });
        } else {
            options.coveragePromise.resolve(options.coverage);
        }
    }
};

let reporter = {
    options: {
        directory: 'auto',
        console: true,
        json: false,
        html: false
    },

    report(options) {
        var reportConsole = options.console;
        var json = options.json;
        var html = options.html;

        if (reportConsole || json || html) {
            if (options.directory === 'auto') {
                var mainURIClone = env.mainURI.clone();
                mainURIClone.protocol = ''; // remove the file:/// protocol on node
                mainURIClone.suffix = '';
                mainURIClone.filename += '-coverage';

                console.log('report directory :', mainURIClone.href);

                options.directory = mainURIClone.href;
            }

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

            env.run(function() {
                return options.coveragePromise.then(function(coverage) {
                    collector.add(coverage);
                    var writerPromise = new Promise(function(resolve) {
                        reporter.write(collector, false, resolve);
                    });
                    return writerPromise;
                });
            });
        }
    }
};

let uploader = {
    options: {
        codecov: false,
        codecovToken: 'auto'
    },

    upload(options) {
        if (options.codecov) {
            if (options.codecovToken === 'auto' && process.env.CODECOV_TOKEN) {
                options.codecovToken = process.env.CODECOV_TOKEN;
            }

            env.run(function() {
                return options.coveragePromise.then(function(coverage) {
                    return env.importDefault('./upload.js', __moduleName).then(function(upload) {
                        return upload(env, JSON.stringify(coverage), options.codecovToken);
                    });
                });
            });
        }
    }
};

// https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js
let coverPlugin = {
    name: 'cover',
    defaultOptions: {
        cover: coverer.options,
        report: reporter.options,
        upload: uploader.options
    },

    install(options) {
        var resolve;
        var reject;
        var coveragePromise = new Promise(function(res, rej) {
            resolve = res;
            reject = rej;
        });
        coveragePromise.resolve = resolve;
        coveragePromise.reject = reject;

        options.cover.coveragePromise = coveragePromise;
        options.report.coveragePromise = coveragePromise;
        options.upload.coveragePromise = coveragePromise;

        coverer.cover(options.cover);
        reporter.report(options.report);
        uploader.upload(options.upload);
    }
};

export default coverPlugin;
