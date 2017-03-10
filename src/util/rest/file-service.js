import fs from '@node/fs';

import Url from '@jsenv/url';

function createExecutorCallback(resolve, reject) {
    return function(error, result) {
        if (error) {
            reject(error);
        } else {
            resolve(result);
        }
    };
}
function callback(fn, ...args) {
    return new Promise(function(resolve, reject) {
        args.push(createExecutorCallback(resolve, reject));
        fn(...args);
    });
}
function fsAsync(methodName, ...args) {
    return callback(...[fs[methodName], ...args]);
}
function transformFsError(error) {
    if (error) {
        // https://iojs.org/api/errors.html#errors_eacces_permission_denied
        if (error.code === 'EACCES') {
            return {
                status: 403
            };
        }
        if (error.code === 'EPERM') {
            return {
                status: 403
            };
        }
        if (error.code === 'ENOENT') {
            return {
                status: 404
            };
        }
        // file access may be temporarily blocked
        // (by an antivirus scanning it because recently modified for instance)
        if (error.code === 'EBUSY') {
            return {
                status: 503,
                headers: {
                    'retry-after': 0.01 // retry in 10ms
                }
            };
        }
        // emfile means there is too many files currently opened
        if (error.code === 'EMFILE') {
            return {
                status: 503,
                headers: {
                    'retry-after': 0.1 // retry in 100ms
                }
            };
        }
    }
    return Promise.reject(error);
}
function mimetype(ressource) {
    const defaultMimetype = "application/octet-stream";
    const mimetypes = {
        // text
        "txt": "text/plain",
        "html": "text/html",
        "css": "text/css",
        "appcache": "text/cache-manifest",
        // application
        "js": "application/javascript",
        "json": "application/json",
        "xml": "application/xml",
        "gz": "application/x-gzip",
        "zip": "application/zip",
        "pdf": "application/pdf",
        // image
        "png": "image/png",
        "gif": "image/gif",
        "jpg": "image/jpeg",
        // audio
        "mp3": "audio/mpeg"
    };
    const suffix = ressource.suffix;
    if (suffix in mimetypes) {
        return mimetypes[suffix];
    }
    return defaultMimetype;
}
function readDirectory(ressource, options) {
    if (options.canReadDirectory) {
        return fsAsync('readdir', ressource.id).then(JSON.stringify).then(function(body) {
            return {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                    'content-length': body.length
                },
                body: body
            };
        });
    }
    return {
        status: 403
    };
}
function readFile(ressource) {
    const meta = ressource.meta;

    if ('cachedModificationDate' in meta && 'actualModificationDate' in meta) {
        const cachedModificationDate = meta.cachedModificationDate;
        const actualModificationDate = meta.actualModificationDate;
        if (Number(cachedModificationDate) < Number(actualModificationDate)) {
            return {
                status: 304
            };
        }
    }

    const properties = {
        status: 200,
        headers: {
            'content-type': mimetype(ressource)
        }
    };
    if ('size' in meta) {
        properties.headers['content-length'] = meta.size;
    }
    if (ressource.action === 'GET') {
        properties.body = fs.createReadStream(ressource.id);
    }
    return properties;
}
function readRessource(ressource, options) {
    return fsAsync('stat', ressource.id).then(
        stat => {
            return Promise.resolve().then(() => {
                ressource.meta.actualModificationDate = stat.mtime;
                ressource.meta.size = stat.size;
                if (stat.isDirectory()) {
                    return readDirectory(ressource, options);
                }
                return readFile(ressource, options);
            }).then(properties => {
                if (!properties.headers) {
                    properties.headers = {};
                }

                if ('actualModificationDate' in ressource.meta) {
                    properties.headers['last-modified'] = ressource.meta.actualModificationDate.toUTCString();
                }
                // for google chrome
                properties.headers['cache-control'] = 'no-store';
                return properties;
            });
        },
        transformFsError
    );
}
function createFileService(options) {
    options = options || {};
    const rootURL = Url.create('file:///' + options.root);

    return {
        get(request) {
            var urlRessource = request.url.ressource;
            if (urlRessource === '') {
                urlRessource = options.index;
            }
            const ressourceUrl = rootURL.resolve(urlRessource);
            console.log('getting', rootURL.toString());

            const ressource = {
                id: ressourceUrl.ressource,
                suffix: ressourceUrl.suffix,
                action: request.method,
                meta: {}
            };

            if (request.headers.has('if-modified-since')) {
                let cachedModificationDate;
                try {
                    cachedModificationDate = new Date(request.headers.get('if-modified-since'));
                } catch (e) {
                    // the request headers if-modified-since is not a valid date
                    return 400;
                }
                ressource.meta.cachedModificationDate = cachedModificationDate;
            }
            return readRessource(ressource, options);
        }
    };
}

export default createFileService;
