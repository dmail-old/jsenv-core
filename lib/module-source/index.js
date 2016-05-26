import jsenv from 'jsenv';
import proto from 'proto';

var System = jsenv.System;

// get real file name from sourceURL comment
function readSourceUrl(source) {
    var lastMatch;
    var match;
    var sourceURLRegexp = /\/\/#\s*sourceURL=\s*(\S*)\s*/mg;
    while (match = sourceURLRegexp.exec(source)) { // eslint-disable-line
        lastMatch = match;
    }

    return lastMatch ? lastMatch[1] : null;
}

function readSourceMappingURL(source) {
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

function isBase64Url(url) {
    var base64SourceMapRegexp = /^data:application\/json[^,]+base64,/;

    return base64SourceMapRegexp.test(url);
}

// to be able to do System.import on .map files and get json output
// System.meta['*.map'] = {format: 'json'};
let SourceMap = proto.extend('SourceMap', {
    source: undefined,
    url: null,
    map: null,

    constructor(source, url) {
        this.source = source;
        this.url = url;
    },

    fetch() {
        var url = this.url;
        var mapPromise;

        if (this.map) {
            mapPromise = Promise.resolve(this.map);
        } else {
            // engine.debug('the sourcemap url is', sourceMapURL);
            mapPromise = System.import(url);
        }

        return mapPromise.then(function(map) {
            this.map = map;
        }.bind(this));
    }
});

let Source = proto.extend('Source', {
    data: undefined,
    name: undefined,
    url: undefined,

    constructor(load, data) {
        this.load = load;
        this.data = data;
        this.name = load.name;

        let loadMetadata = load.metadata;
        let loadFormat = loadMetadata.format;
        if (loadFormat !== 'json') {
            var sourceURL = readSourceUrl(this.data);
            if (sourceURL) {
                this.url = sourceURL;
            } else {
                this.url = this.name;
            }

            // we could speed up sourcemap by reading it from load.metadata.sourceMap;
            // but systemjs set it to undefined after transpilation (load.metadata.sourceMap = undefined)
            // saying it's now useless because the transpiled embeds it in base64
            // https://github.com/systemjs/systemjs/blob/master/dist/system.src.js#L3578
            // I keep this commented as a reminder that sourcemap could be available using load.metadata
            // I may open an issue on github about this, fore as it's only a perf issue I think it will never happen
            // function readSourceMapFromModuleMeta() { }

            var sourceMapUrl = readSourceMappingURL(this.data);
            if (sourceMapUrl) {
                if (isBase64Url(sourceMapUrl)) {
                    // Support source map URL as a data url
                    var rawData = sourceMapUrl.slice(sourceMapUrl.indexOf(',') + 1);
                    var map = JSON.parse(new Buffer(rawData, 'base64').toString());

                    this.sourceMap = SourceMap.create(this, sourceMapUrl);
                    this.sourceMap.map = map;
                } else {
                    sourceMapUrl = new URL(sourceMapUrl, this.url).href; // allow source map urls to be relative to the sourceURL
                    this.sourceMap = SourceMap.create(this, sourceMapUrl);
                }
            } else {
                this.sourceMap = null;
            }
        }
    },

    isTranspiled() {
        return Boolean(this.sourceMap);
    },

    fetchParent() {
        if (this.isTranspiled()) {
            return this.sourceMap.fetch().then(function(map) {
                return map.sourcesContent.map(function(sourceContent, i) {
                    var source = map.sources[i];
                    var sourceName = new URL(source, this.sourceMap.url).href;

                    return Source.create(source, sourceName);
                }, this);
            }.bind(this)).then(function(sources) {
                return sources[0];
            });
        }
        return Promise.resolve(null);
    },

    // get the root source which generated this one or null
    fetchRoot() {
        let rootSource;
        // let parentSource = this.fetchParent();

        return rootSource;
    }
});

export default Source;
