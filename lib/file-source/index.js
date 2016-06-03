/* global URL */
/* env browser, node */

import env from 'env';
import proto from 'env/proto';
import fetchAsText from 'env/fetch-as-text';

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
    content: null,
    // result: null,

    constructor(url) {
        this.url = url;
    },

    eval(content) {
        return content;
    },

    setContent(content) {
        this.content = content;
        return this.eval(content);
    },

    fetch() {
        let fetchPromise;

        if (this.hasOwnProperty('fetchPromise')) {
            fetchPromise = this.fetchPromise;
        } else {
            if (this.content) {
                fetchPromise = Promise.resolve(this.content);
            } else {
                fetchPromise = fetchAsText(this.url);
            }

            this.fetchPromise = fetchPromise;
        }

        // engine.debug('the sourcemap url is', sourceMapURL);
        return fetchPromise;
    },

    createImportPromise() {
        return this.fetch().then(function(content) {
            return this.setContent(content);
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
    redirections: {},

    create(url, ignoreCache) {
        url = new URL(url, env.baseURL).href;

        var cachedInstance;
        if (ignoreCache) {

        } else {
            var redirectedURL = this.followRedirections(url);

            if (redirectedURL in this.cache) {
                cachedInstance = this.cache[redirectedURL];
            }
        }

        var instance;
        if (cachedInstance) {
            instance = cachedInstance;
        } else {
            instance = File.create.call(this, url);
            this.cache[url] = instance;
        }

        return instance;
    },

    followRedirections: function(url) {
        let redirections = this.redirections;
        let redirectedURL = url;
        while (redirectedURL in redirections) {
            redirectedURL = redirections[redirectedURL];
        }

        return redirectedURL;
    },

    eval(content) {
        var sourceURL = findSourceUrl(content);
        if (sourceURL) {
            var url = this.url;
            // console.log('resolve source url', sourceURL, 'for', this.url);
            var fullSourceURL = new URL(sourceURL, url).href;

            this.redirections[url] = fullSourceURL;
            this.url = fullSourceURL;
            delete this.cache[url];
            this.cache[fullSourceURL] = this;
        }

        var sourceMapURL = findSourceMappingURL(content);
        if (sourceMapURL) {
            if (isBase64Url(sourceMapURL)) {
                // Support source map URL as a data url
                var rawData = sourceMapURL.slice(sourceMapURL.indexOf(',') + 1);
                sourceMapURL = this.url;
                this.sourceMap = SourceMapFile.create(sourceMapURL);
                this.sourceMap.setContent(new Buffer(rawData, 'base64').toString());

                // console.log('set sourcemap for', this.url, 'from base64');
            } else {
                sourceMapURL = new URL(sourceMapURL, this.url).href; // allow source map urls to be relative to the sourceURL
                this.sourceMap = SourceMap.create(sourceMapURL);

                // console.log('set sourcemap for', this.url, 'to', sourceMapURL);
            }
        }

        return content;
    },

    prepare(isOriginUrl) {
        // we precheck the isOriginUrl but in case the content contains sourceURL= we may assume it's an originUrl while it's not
        // but fetching all url searching for a #sourceURL comment is ressource consuming especially when we'll try to fetch callSite
        // for now keep as it is

        return Promise.resolve(isOriginUrl ? isOriginUrl(this.url) : false).then(function(isOrigin) {
            if (isOrigin === true) {
                return undefined;
            }

            return this.import().then(function() {
                var sourceMap = this.sourceMap;

                if (sourceMap) {
                    return sourceMap.import().then(function() {
                        // a file may refer to multiple sources, that's why this.origin should be an array like
                        // this origins = []; array of file used to generate this one
                        // all origin files must be prepared as well in that case
                        var sourceMapData = sourceMap.data;
                        var sources;
                        if ('sources' in sourceMapData) {
                            sources = sourceMapData.sources;
                        }
                        var sourcesContent;
                        if ('sourcesContent' in sourceMapData) {
                            sourcesContent = sourceMapData.sourcesContent;
                        }
                        var file;
                        if ('file' in sourceMapData) {
                            file = sourceMapData.file;
                        }

                        if (sources) {
                            console.log('origins of', this.url, 'are', sources);

                            this.origins = sources.map(function(source) {
                                var originURL = new URL(source, sourceMap.url).href;

                                console.log('locate origin at', originURL, 'from', source);

                                return FileSource.create(originURL, true);
                            }, this);

                            if (sourcesContent) {
                                sourcesContent.forEach(function(sourceContent, index) {
                                    this.origins[index].setContent(sourceContent);
                                }, this);
                            }
                        } else if (file) {
                            var originURL = new URL(file, sourceMap.url).href;

                            this.origins = [
                                FileSource.create(originURL, true)
                            ];
                        } else {
                            this.origins = [];
                        }

                        var originsPromises = this.origins.map(function(origin) {
                            return origin.prepare(isOriginUrl);
                        }, this);

                        return Promise.all(originsPromises);
                    }.bind(this));
                }
            }.bind(this));
        }.bind(this)).then(function() {
            this.prepared = true;
        }.bind(this));
    },

    getOriginalSource() {
        if (!this.prepared) {
            throw new Error('getOriginalSource() must be called on prepared filesource');
        }

        let originalSource = '';
        if (this.sourceMap) {
            originalSource = this.origins.map(function(origin) {
                return origin.getOriginalSource();
            }).join('');
        } else {
            originalSource = this.content;
        }

        return originalSource;
    },

    getOriginalPosition(position) {
        if (!this.prepared) {
            throw new Error('getOriginalPosition() must be called on prepared filesource');
        }

        let originalPosition;

        if (this.sourceMap) {
            // now I have the original position for this I may realize that this
            let sourceMapPosition = this.sourceMap.consumer.originalPositionFor(position);

            if (sourceMapPosition && sourceMapPosition.source) {
                // ok get the orignal postion for this source
                var sourceOrigin = this.origins.find(function(origin) {
                    return origin.url === sourceMapPosition.source;
                });

                if (!sourceOrigin) {
                    throw new Error(
                        'sourceMap says original position source is ' +
                        sourceMapPosition.source + ' but this source is not part of origins'
                    );
                }

                return sourceOrigin.originalPositionFor({
                    file: sourceMapPosition.file,
                    // bias: sourceMapPosition.bias
                    column: sourceMapPosition.column
                });
            }
        } else {
            originalPosition = position;
        }

        return originalPosition;
    }
});

export default FileSource;
