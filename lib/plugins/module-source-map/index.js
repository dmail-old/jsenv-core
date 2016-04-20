import jsenv from 'jsenv';

import moduleScriptNames from 'jsenv/plugin/module-script-name';

jsenv.config('module-meta-sourcemap', function() {
    // we could speed up sourcemap reading by storing load.metadata.sourceMap;
    // but anyway systemjs do load.metadata.sourceMap = undefined
    // so I just set this as a reminder that sourcemap could be available if set on load.metadata by the transpiler
}).skip('not ready yet');

function readSourceMapURL(source) {
    // Keep executing the search to find the *last* sourceMappingURL to avoid
    // picking up sourceMappingURLs from comments, strings, etc.
    var lastMatch;
    var match;
    // eslint-disable-next-line
    var sourceMappingURLRegexp = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+?)[ \t]*$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^\*]+?)[ \t]*(?:\*\/)[ \t]*$)/mg;
    while (match = sourceMappingURLRegexp.exec(source)) { // eslint-disable-line
        lastMatch = match;
    }

    return lastMatch ? lastMatch[1] : null;
}

// returns a {map, optional url} object, or null if there is no source map
function fetchSourceMapData(source, rootURL) {
    var sourceMapURL = readSourceMapURL(source);
    var sourceMapPromise;

    if (sourceMapURL) {
        var base64SourceMapRegexp = /^data:application\/json[^,]+base64,/;
        if (base64SourceMapRegexp.test(sourceMapURL)) {
            // Support source map URL as a data url
            var rawData = sourceMapURL.slice(sourceMapURL.indexOf(',') + 1);
            var sourceMap = JSON.parse(new Buffer(rawData, 'base64').toString());
            // engine.debug('read sourcemap from base64 for', rootURL);
            sourceMapPromise = Promise.resolve(sourceMap);
            sourceMapURL = null;
        } else {
            // Support source map URLs relative to the source URL
            // engine.debug('the sourcemap url is', sourceMapURL);
            sourceMapURL = jsenv.locateFrom(sourceMapURL, rootURL, true);

            // try {
            sourceMapPromise = Promise.resolve(require(sourceMapURL));
            // } catch (e) {
            //     sourceMapPromise = Promise.resolve();
            // }
        }
    } else {
        sourceMapPromise = Promise.resolve();
    }

    return sourceMapPromise.then(function(sourceMap) {
        if (sourceMap) {
            return {
                url: sourceMapURL,
                map: sourceMap
            };
        }
        return null;
    });
}

let sourceMaps = new Map();
function detectSourceMap(source, rootURL) {
    var sourceURL = moduleScriptNames.store(source, rootURL);

    // now read sourceMap url and object from the source
    return fetchSourceMapData(source, sourceURL).then(function(sourceMapData) {
        // if we find a sourcemap, store it
        if (sourceMapData) {
            var sourceMap = sourceMapData.map;
            var sourceMapUrl = sourceMapData.url;

            // engine.debug('set sourcemap for', sourceURL, Boolean(sourceMap));
            sourceMaps.set(sourceURL, sourceMap);

            // if sourcemap has contents check for nested sourcemap in the content
            var sourcesContent = sourceMap.sourcesContent;
            if (sourcesContent) {
                return Promise.all(sourceMap.sources.map(function(source, i) {
                    var content = sourcesContent[i];
                    if (content) {
                        // we cannot do engine.moduleSources.set(source, content)
                        // because we can have many transpilation level like
                        // moduleSource -> babelSource -> minifiedSource

                        var sourceMapLocation;
                        // nested sourcemap can be relative to their parent
                        if (sourceMapUrl) {
                            sourceMapLocation = jsenv.locateFrom(source, sourceMapUrl);
                        } else {
                            sourceMapLocation = jsenv.locate(source);
                        }

                        return detectSourceMap(content, sourceMapLocation);
                    }
                    return undefined;
                }));
            }
        } else if (sourceMaps.has(sourceURL) === false) {
            // if no sourcemap is found store a null object to know their is no sourcemap for this file
            // the check sourceMaps.has(sourceURL) === false exists to prevent a indetical source wo
            // sourcemap to set sourcemap to null when we already got one
            // it happen when sourceMap.sourcesContent exists but does not contains sourceMap
            sourceMaps.set(sourceURL, null);
        }
    });
}

let translate = System.translate;
System.translate = function(load) {
    return translate.call(this, load).then(function(source) {
        var metadata = load.metadata;
        var format = metadata.format;
        if (format === 'json' || format === 'defined' || format === 'global' || metadata.loader) {
            return source;
        }

        return detectSourceMap(source, load.name).then(function() {
            return source;
        });
    });
};

export default sourceMaps;
