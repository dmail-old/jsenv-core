import jsenv from 'jsenv';
import Options from 'jsenv/options';
import moduleScriptNames from 'jsenv/plugin/module-script-name';
import moduleSourceMaps from 'jsenv/plugin/module-source-map';

import fs from '@node/fs';
import require from '@node/require';

// https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js
let coverage = {
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
                        return instrumenter.instrumentSync(source, loadUrl.slice(jsenv.baseURL.length));
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

        jsenv.run(function storeCoverageValue() {
            var variableName = coverage.variableName;
            if (variableName in jsenv.global) {
                coverage.value = jsenv.global[variableName];
            }
            // engine.debug('raw coverage object', self.value);
        });
    },

    collect(coverageResult) {
        var remapIstanbul = require('remap-istanbul/lib/remap');

        var collector = remapIstanbul(coverageResult, {
            // this function is faking that there is a file pointing to a sourcemap when needed
            readFile: function(path) {
                var url = jsenv.locate(path);
                var source = ''; // engine.moduleSources.get(url);
                var sourceMap = moduleSourceMaps.get(url);

                if (sourceMap) {
                    source += '\n//# sourceMappingURL=' + path.split('/').pop() + '.map';
                }

                return source;
            },

            readJSON: function(path) {
                var sourceMapFileUrl = jsenv.locate(path);
                var sourceMapOwnerUrl = sourceMapFileUrl.slice(0, -'.map'.length);
                var sourceMap = moduleSourceMaps.get(sourceMapOwnerUrl);

                if (!sourceMap) {
                    var nodeFilePath = jsenv.locate(sourceMapFileUrl, true);
                    return JSON.parse(fs.readFileSync(nodeFilePath));
                }

                // the idea there is really to make source relative to sourceMapFileURL
                // we need sth like engine.relative()
                // it would also be used in instrumentSync currently hardcoded with slice(engine.baseURL.length)
                // somthing like URL.prototype.relativeTo(otherURL)
                var pathBase = jsenv.parentPath(sourceMapFileUrl);
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
};

var options = Options.create(jsenv.options.plugins['module-coverage']);

coverage.install(options);
jsenv.run(function() {
    return coverage.collect(coverage.value).then(function(collector) {
        return coverage.report(collector, options);
    });
});

export default coverage;
