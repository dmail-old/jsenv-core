/* env browser, node */

// import jsenv from 'jsenv';

import moduleSourceUrls from './module-source-url.js';

let sourceMaps = new Map();

// to be able to do System.import on .map files and get json output
System.meta['*.map'] = {format: 'json'};

var SourceMap = {
    url: null,
    sourceURL: null,
    map: null,

    constructor(url, sourceURL) {
        this.url = url;
        this.sourceURL = sourceURL;
    },

    isBase64Url: function() {
        var base64SourceMapRegexp = /^data:application\/json[^,]+base64,/;

        return base64SourceMapRegexp.text(this.url);
    },

    fetch() {
        var url = this.url;
        var mapPromise;

        if (this.map) {
            mapPromise = Promise.resolve(this.map);
        } else if (this.isBase64Url()) {
            // Support source map URL as a data url
            var rawData = url.slice(url.indexOf(',') + 1);
            var sourceMap = JSON.parse(new Buffer(rawData, 'base64').toString());
            // engine.debug('read sourcemap from base64 for', rootURL);
            mapPromise = Promise.resolve(sourceMap);
        } else {
            url = new URL(url, this.sourceURL); // Support source map URLs relative to the source URL
            this.sourceURL = url;
            // engine.debug('the sourcemap url is', sourceMapURL);

            mapPromise = System.import(url);
        }

        return mapPromise;
    },

    import() {
        var importPromise = this.fetch();

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

// we could speed up sourcemap reading by reading it from load.metadata.sourceMap;
// but systemjs set it to undefined after transpilation (load.metadata.sourceMap = undefined)
// saying it's now useless because the transpiled embeds it in base64
// https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L3578
// I keep this commented as a reminder that sourcemap could be available using load.metadata
// I may open an issue on github about this, fore as it's only a perf issue I think it will never happen
// function readSourceMapFromModuleMeta() { }

export default sourceMaps;
