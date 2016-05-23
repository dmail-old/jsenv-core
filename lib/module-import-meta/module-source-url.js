let moduleSourceUrls = new Map();

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

function getLoadOrSourceURL(source, loadURL) {
    let loadSourceURL = readSourceUrl(source);
    let loadOrSourceURL;
    // get filename from the source if //# sourceURL exists in it
    if (loadSourceURL) {
        loadOrSourceURL = loadSourceURL;
    } else {
        loadOrSourceURL = loadURL;
    }

    return loadOrSourceURL;
}

moduleSourceUrls.store = function(source, loadURL) {
    let loadOrSourceURL;

    if (this.has(loadURL)) {
        loadOrSourceURL = this.get(loadURL);
    } else {
        loadOrSourceURL = getLoadOrSourceURL(source, loadURL);
        this.set(loadURL, loadOrSourceURL);
    }

    return loadOrSourceURL;
};

let translate = System.translate;
System.translate = function(load) {
    return translate.call(this, load).then(function(source) {
        moduleSourceUrls.store(source, load.name);
        return source;
    });
};

export default moduleSourceUrls;
