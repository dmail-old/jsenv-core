// import jsenv from 'jsenv';
import proto from 'proto';
import fetchAsText from 'jsenv/fetch-as-text';

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
    content: null,
    result: null,

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

let SourceMap = File.extend('SourceMap', {
    eval: JSON.parse
});

let Source = File.extend('Source', {
    child: null,

    eval(content) {
        var sourceURL = findSourceUrl(content);
        if (sourceURL) {
            this.url = sourceURL;
        }

        var sourceMapUrl = findSourceMappingURL(content);
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

        return content;
    },

    // import the parent
    createParentImportPromise() {
        return this.sourceMap.import().then(function(map) {
            var parentSourceURL;
            if ('file' in map) {
                parentSourceURL = new URL(map.file, this.sourceMap.url).href;
            } else {
                parentSourceURL = this.url;
            }
            var parentSource = Source.create(parentSourceURL);

            if ('sourceRoot' in map) {
                map.sources = map.sources.map(function(source) {
                    return new URL(source, map.sourceRoot).href;
                });
            }

            // check is sourceContent is embeded in the sourcemap
            if ('sourcesContent' in map) {
                // allow source to be relative to the sourcemap location
                var sourceUrls = map.sources.map(function(source) {
                    return new URL(source, this.sourceMap.url).href;
                }, this);

                var sourceUrlIndex = sourceUrls.findIndex(function(sourceUrl) {
                    return sourceUrl === parentSourceURL;
                });

                if (sourceUrlIndex in map.sourcesContent) {
                    parentSource.setContent(map.sourcesContent[sourceUrlIndex]);
                }
            }

            this.parent = parentSource;
            parentSource.child = this;

            return this.parent.import();
        }.bind(this));
    },

    createImportPromise() {
        return File.createImportPromise.call(this).then(function() {
            if (this.sourceMap) {
                return this.createParentImportPromise();
            }
            return this;
        }.bind(this));
    }
});

export default Source;
