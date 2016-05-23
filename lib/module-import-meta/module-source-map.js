/* env browser, node */

// import jsenv from 'jsenv';

import moduleSourceUrls from './module-source-url.js';

let sourceMaps = new Map();

// to be able to do System.import on .map files and get json output
System.meta['*.map'] = {format: 'json'};

/*
jsenv.config('module-meta-sourcemap', function() {
    // we could speed up sourcemap reading by storing load.metadata.sourceMap;
    // but anyway systemjs do load.metadata.sourceMap = undefined
    // so I just set this as a reminder that sourcemap could be available if set on load.metadata by the transpiler
}).skip('not ready yet');
*/

var SourceMap = {
    isBase64Url: false,

    constructor(url, sourceURL) {
        this.url = url;
        this.sourceURl = sourceURL;
    },

    fetch() {
        var url = this.url;
        var mapPromise;

        // Support source map URL as a data url
        var base64SourceMapRegexp = /^data:application\/json[^,]+base64,/;
        if (base64SourceMapRegexp.test(url)) {
            this.isBase64Url = true;

            var rawData = url.slice(url.indexOf(',') + 1);
            var sourceMap = JSON.parse(new Buffer(rawData, 'base64').toString());
            // engine.debug('read sourcemap from base64 for', rootURL);
            mapPromise = Promise.resolve(sourceMap);
        } else {
            // Support source map URLs relative to the source URL
            url = new URL(url, this.sourceURL);
            this.sourceURL = url;
            // engine.debug('the sourcemap url is', sourceMapURL);

            mapPromise = System.import(url);
        }

        return mapPromise;
    },

    import() {
        var importPromise = this.fetch();

        if (this.isBase64Url === false) {
            importPromise = importPromise.then(function(map) {
                var sourcesContent = map.sourcesContent;

                // if sourcemap has contents check for nested sourcemap in the content
                if (sourcesContent) {
                    map.sources.forEach(function(source, i) {
                        // we cannot do engine.moduleSources.set(source, content)
                        // because we can have many transpilation level like
                        // moduleSource -> babelSource -> minifiedSource

                        var content = sourcesContent[i];
                        if (content) {
                            // nested sourcemap can be relative to their container map
                            var contentURL = new URL(source, this.sourceURL).href;
                            this.detect(content, contentURL);
                        }
                    }, this);
                }

                return map;
            }.bind(this));
        }

        return importPromise;
    },

    create() {
        var sourceMap = Object.create(this);
        sourceMap.constructor.apply(sourceMap, arguments);
        return sourceMap;
    },

    detect(moduleSource, moduleName) {
        var sourceURL = moduleSourceUrls.store(moduleSource, moduleName);
        // read sourceMap url and object from the source
        var sourceMap = createSourceMap(moduleSource, sourceURL);

        if (sourceMap) {
            sourceMaps.set(sourceURL, sourceMap);
        } else if (sourceMaps.has(sourceURL) === false) {
            // if no sourcemap is found store a null object to know their is no sourcemap for this file
            // the check sourceMaps.has(sourceURL) === false exists to prevent a indetical source wo
            // sourcemap to set sourcemap to null when we already got one
            // it happen when sourceMap.sourcesContent exists but does not contains sourceMap
            sourceMaps.set(sourceURL, null);
        }
    }
};

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
function createSourceMap(source, sourceURL) {
    var sourceMapURL = readSourceMapURL(source);
    var sourceMap;

    if (sourceMapURL) {
        sourceMap = SourceMap.create(sourceMapURL, sourceURL);
    } else {
        sourceMap = null;
    }

    return sourceMap;
}

let translate = System.translate;
System.translate = function(load) {
    return translate.call(this, load).then(function(source) {
        var metadata = load.metadata;
        var format = metadata.format;
        if (format === 'json' || format === 'defined' || format === 'global' || metadata.loader) {
            return source;
        }

        return SourceMap.detect(source, load.name).then(function() {
            return source;
        });
    });
};

export default sourceMaps;
