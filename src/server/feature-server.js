/*
myRest.use({
    match(request) {
        return request.headers.get('accept').includes('application/x-es-module');
    },

    methods: {
        get(request) {
            const filepath = request.url.ressource;
            console.log('the file at', filepath);

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

            let promise = fsAsync('stat', filepath).then(function(stat) {
                if (stat.isDirectory()) {
                    return {
                        status: 403
                    };
                }

                if (request.headers.has('if-modified-since')) {
                    // the request headers if-modified-since is not a valid date
                    let mtime;

                    try {
                        mtime = new Date(request.headers.get('if-modified-since'));
                    } catch (e) {
                        return 400;
                    }

                    if (stat.mtime <= mtime) {
                        return {
                            status: 304,
                            headers: {
                                'last-modified': stat.mtime.toUTCString()
                            }
                        };
                    }
                }

                const properties = {
                    status: 200,
                    headers: {
                        'last-modified': stat.mtime.toUTCString(),
                        'content-type': 'application/javascript',
                        'content-length': stat.size
                    }
                };

                if (request.method === 'GET') {
                    return fsAsync('readFile', filepath).then(function(buffer) {
                        const fileContent = buffer.toString();
                        const transpiledContent = transpile(fileContent, filepath);
                        properties.body = transpiledContent;
                        properties.headers['content-length'] = Buffer.byteLength(transpiledContent);
                        return properties;
                    }, transformFsError);
                }
                return properties;
            }, transformFsError);

            return promise;
        }
    }
});
*/
