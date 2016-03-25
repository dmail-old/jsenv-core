// keep in mind __moduleName
// s'inspirer du module node-stacktrace pour la mise en place de codecov.io
// https://github.com/guybedford/jspm-test-demo/blob/master/lib/coverage.js

var istanbul = require('istanbul');
var remapIstanbul = require('remap-istanbul/lib/remap');
var fs = require('fs');
// var nodepath = require('path');
// var cp = require('child_process');
require('systemjs');

System.transpiler = 'babel';
System.babelOptions = {};

var fileURL = 'file:///' + __dirname + '/file-to-cover.js'; // eslint-disable-line no-path-concat
fileURL = fileURL.replace(/\\/g, '/');

var coverageType = 'json'; // could also be text
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

var originalSources = {};

function retrieveSourceMapURL(source) {
    // Get the URL of the source map
    //        //# sourceMappingURL=foo.js.map                       /*# sourceMappingURL=foo.js.map */
    // eslint-disable-next-line
    var re = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/)[ \t]*$)/mg;
    // Keep executing the search to find the *last* sourceMappingURL to avoid
    // picking up sourceMappingURLs from comments, strings, etc.
    var lastMatch;
    var match;
    while (match = re.exec(source)) { // eslint-disable-line
        lastMatch = match;
    }

    return lastMatch ? lastMatch[1] : null;
}

var systemTranslate = System.translate;
// Override SystemJS translate hook to instrument original sources with Istanbul.
System.translate = function(load) {
    var originalSource = load.source;

    return systemTranslate.call(this, load).then(function(source) {
        if (load.metadata.format === 'json' || load.metadata.format === 'defined' || load.metadata.loader) {
            return source;
        }

        var dirname = 'file:///' + __dirname.replace(/\\/g, '/');

        console.log(load.name, load.name.indexOf(dirname) === 0);

        if (load.name.indexOf(dirname) !== 0) {
            return source;
        }

        // console.log('translating', load.name, 'do we have sourcemap', load.metadata.sourceMap, source);

        /*
        custom logic to exclude some files
        if (false) {
            return source;
        }
        */

        var sourceMap = load.metadata.sourceMap;

        // get sourcemap from transpiled source because systemjs do load.metadata.sourceMap = undefined
        if (!sourceMap) {
            var sourceMappingURL = retrieveSourceMapURL(source);
            if (sourceMappingURL) {
                var sourceMapData;
                var reSourceMap = /^data:application\/json[^,]+base64,/;
                if (reSourceMap.test(sourceMappingURL)) {
                    // Support source map URL as a data url
                    var rawData = sourceMappingURL.slice(sourceMappingURL.indexOf(',') + 1);
                    sourceMapData = new Buffer(rawData, "base64").toString();
                    sourceMappingURL = null;
                } else {
                    sourceMapData = fs.readFileSync(sourceMappingURL);
                }

                sourceMap = sourceMapData;
            }
        }

        originalSources[load.name] = {
            source: originalSource,
            sourceMap: sourceMap
        };

        try {
            return instrumenter.instrumentSync(source, load.address.substr(System.baseURL.length));
        } catch (e) {
            var newErr = new Error('Unable to instrument "' + load.name + '" for istanbul.\n\t' + e.message);
            newErr.stack = 'Unable to instrument "' + load.name + '" for istanbul.\n\t' + e.stack;
            newErr.originalErr = e.originalErr || e;
            throw newErr;
        }
    });
};

console.log('importing', fileURL);

System.import(fileURL).then(function() {
    console.log('executed');

    System.global.process = process;

    var coverage = System.global[istanbulGlobal];
    coverage = coverage || {};

    var collector = remapIstanbul(coverage, {
        readFile: function(path) {
            console.log('read file at', path);

            var originalSourceObject = originalSources[System.baseURL + path];
            var source = originalSourceObject.source;

            if ('sourceMap' in originalSourceObject) {
                source += '\n//# sourceMappingURL=' + path.split('/').pop() + '.map';
            }

            return source;
        },

        readJSON: function(path) {
            path = path.replace(/\\/g, '/');

            var pathBase = System.baseURL + path.split('/').slice(0, -1).join('/');
            var modulePath = System.baseURL + path.substr(0, path.length - 4);
            var originalSourcesObj = originalSources[modulePath];

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
                console.log('get report config for', coverageType);

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

        // then you can do istanbul report --include coverage.json
        // cp.execSync('istanbul report --include coverage.json');
        // reporter.add('lcovonly');
    });
}).catch(function(e) {
    console.log('error', e);

    setTimeout(function() {
        throw e;
    });
});
