import jsenv from 'jsenv';
import proto from 'proto';
import fetchAsText from 'jsenv/fetch-as-text';

import SourceMap from 'source-map';

// get real file name from sourceURL comment
function findSourceUrl(source) {
    var lastMatch;
    var match;
    var sourceURLRegexp = /\/\/#\s*sourceURL=\s*(\S*)\s*/mg;
    while (match = sourceURLRegexp.exec(source)) { // eslint-disable-line
        lastMatch = match;
    }

    return lastMatch ? lastMatch[1] : null;
}

function findSourceMappingURL(source) {
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

let File = proto.extend('File', {
    url: null,
    // content: null,
    // result: null,

    constructor(url) {
        this.url = url;
    },

    eval(content) {
        return content;
    },

    setContent(content) {
        this.fetchPromise = Promise.resolve(content);
    },

    fetch() {
        if (this.fetchPromise) {
            return this.fetchPromise;
        }

        // engine.debug('the sourcemap url is', sourceMapURL);
        this.fetchPromise = fetchAsText(this.url);
        return this.fetchPromise;
    },

    createImportPromise() {
        return this.fetch().then(function(content) {
            return this.eval(content);
        }.bind(this));
    },

    import() {
        let importPromise;

        if (this.hasOwnProperty('importPromise')) {
            importPromise = this.importPromise;
        } else {
            importPromise = this.createImportPromise();
            this.importPromise = importPromise;
        }

        return importPromise;
    }
});

var SourceMapConsumer = SourceMap.SourceMapConsumer;

let SourceMapFile = File.extend('SourceMap', {
    eval(content) {
        var map = JSON.parse(content);

        if ('file' in map) {
            // allow relative file to the map location
            map.file = new URL(map.file, this.url).href;
        }

        if ('sources' in map) {
            if ('sourceRoot' in map && map.sourceRoot) {
                map.sources = map.sources.map(function(source) {
                    return new URL(source, map.sourceRoot).href;
                });
            }

            // check is sourceContent is embeded in the sourcemap
            if ('sourcesContent' in map) {
                // allow source to be relative to the sourcemap location
                map.sources = map.sources.map(function(source) {
                    return new URL(source, this.url).href;
                }, this);
            }
        }

        this.data = map;
        this.consumer = new SourceMapConsumer(map);

        return this.consumer;
    }
});

let FileSource = File.extend('FileSource', {
    origin: null,
    child: null,
    cache: {},

    create(url, ignoreCache) {
        var instance;

        url = new URL(url, jsenv.baseURL).href;

        if (!ignoreCache && url in this.cache) {
            instance = this.cache[url];
        } else {
            instance = File.create.call(this, url);
            this.cache[url] = instance;
        }

        return instance;
    },

    eval(content) {
        var sourceURL = findSourceUrl(content);
        if (sourceURL) {
            console.log('resolve source url', sourceURL, 'for', this.url);

            // delete this.cache[this.url]; // should we delete this ?
            this.url = new URL(sourceURL, this.url).href;
            // both refers to this, BUT we can redefine the origin forcing cache override
            this.cache[this.url] = this;
        }

        var sourceMapURL = findSourceMappingURL(content);
        if (sourceMapURL) {
            if (isBase64Url(sourceMapURL)) {
                // Support source map URL as a data url
                var rawData = sourceMapURL.slice(sourceMapURL.indexOf(',') + 1);
                sourceMapURL = this.url;
                this.sourceMap = SourceMapFile.create(sourceMapURL);
                this.sourceMap.setContent(new Buffer(rawData, 'base64').toString());

                console.log('set sourcemap for', this.url, 'from base64');
            } else {
                sourceMapURL = new URL(sourceMapURL, this.url).href; // allow source map urls to be relative to the sourceURL
                this.sourceMap = SourceMap.create(sourceMapURL);

                console.log('set sourcemap for', this.url, 'to', sourceMapURL);
            }
        }

        return content;
    },

    getOriginalPosition(position) {
        return this.import().then(function() {
            if (this.sourceMap) {
                return this.sourceMap.import().then(function() {
                    return this.sourceMap.consumer.originalPositionFor(position);
                }.bind(this)).then(function(originalPosition) {
                    // support nested sourcemap
                    if (originalPosition && originalPosition.source) {
                        var sourceMap = this.sourceMap;
                        var sourceMapData = sourceMap.data;
                        var originURL = new URL(originalPosition.source, sourceMap.url).ref;
                        var origin = FileSource.create(originURL, true); // i'm not sure why we have to ignore cache here

                        if ('sources' in sourceMapData && 'sourcesContent' in sourceMapData) {
                            var sourceUrlIndex = sourceMapData.sources.findIndex(function(sourceUrl) {
                                return sourceUrl === originURL;
                            });

                            if (sourceUrlIndex in sourceMapData.sourcesContent) {
                                origin.setContent(sourceMapData.sourcesContent[sourceUrlIndex]);
                            }
                        }

                        return origin.getOriginalPosition(originalPosition);
                    }
                    return position;
                });
            }
            return position;
        }.bind(this));
    }
});

export default FileSource;
