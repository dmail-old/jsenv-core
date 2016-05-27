// import jsenv from 'jsenv';
import proto from 'proto';

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

// we must implement this function
function fetchAsText(/* url */) {
    return Promise.resolve('');
}

let SourceMap = proto.extend('SourceMap', {
    url: null,
    map: null,

    constructor(url) {
        this.url = url;
    },

    setContent(content) {
        this.map = JSON.parse(content);
    },

    fetch() {
        var url = this.url;
        var mapPromise;

        if (this.map) {
            mapPromise = Promise.resolve(this.map);
        } else {
            // engine.debug('the sourcemap url is', sourceMapURL);
            mapPromise = fetchAsText(url).then(function(content) {
                this.setContent(content);
                return this.map;
            }.bind(this));
        }

        return mapPromise.then(function(map) {
            this.map = map;
        }.bind(this));
    }
});

let Source = proto.extend('Source', {
    url: undefined,
    content: undefined,

    constructor(url) {
        this.url = url;
    },

    fetch() {
        if (this.content) {
            return Promise.resolve(this.content);
        }
        // we must fetch this.url
        return fetchAsText(this.url).then(function(content) {
            this.setContent(content);
            return content;
        }.bind(this));
    },

    setContent(content) {
        this.content = content;

        var sourceURL = readSourceUrl(content);
        if (sourceURL) {
            this.url = sourceURL;
        }

        var sourceMapUrl = readSourceMappingURL(content);
        if (sourceMapUrl) {
            if (isBase64Url(sourceMapUrl)) {
                this.sourceMap = SourceMap.create(this.url);

                // Support source map URL as a data url
                var rawData = sourceMapUrl.slice(sourceMapUrl.indexOf(',') + 1);
                this.sourceMap.setContent(new Buffer(rawData, 'base64').toString());
            } else {
                sourceMapUrl = new URL(sourceMapUrl, this.url).href; // allow source map urls to be relative to the sourceURL
                this.sourceMap = SourceMap.create(sourceMapUrl);
            }
        }
    },

    hasSourceMap() {
        return Boolean(this.sourceMap);
    },

    fetchParent() {
        return this.fetch().then(function() {
            if (this.hasSourceMap()) {
                return this.sourceMap.fetch().then(function(map) {
                    var parentUrl = new URL(map.file, this.sourceMap.url).href;
                    var parentSource = Source.create(parentUrl);

                    // now we have the sourceIndex check if it's embedded in the sourcemap
                    if (map.sourcesContent) {
                        // allow source to be relative to the sourcemap location
                        var sourceUrls = map.sources.map(function(source) {
                            return new URL(source, this.sourceMap.url).href;
                        }, this);

                        var sourceUrlIndex = sourceUrls.findIndex(function(sourceUrl) {
                            return sourceUrl === parentUrl;
                        });

                        if (sourceUrlIndex in map.sourcesContent) {
                            parentSource.setContent(map.sourcesContent[sourceUrlIndex]);
                        }
                    }

                    return parentSource;
                }.bind(this));
            }

            return this;
        }.bind(this));
    },

    // get the root source which generated this one or null
    fetchRoot() {
        let rootSource;
        // let parentSource = this.fetchParent();

        return rootSource;
    }
});

export default Source;
