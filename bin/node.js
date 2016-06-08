module.exports = function run(filename, options) {
    require('../index.js');

    return global.jsenv.generate().then(function(env) {
        // jsenv.debug('start with params', options);

        if (options.test && false) {
            env.config('module-test', function() {
                return System.import('env/module-test').then(function(exports) {
                    return exports.default.test({
                        location: env.mainModule.href
                    });
                });
            });
        }
        if (options.cover) {
            env.config('module-coverage', function() {
                return System.import('env/module-coverage').then(function(exports) {
                    var coverOptions = {};

                    var mainURI = env.createURI(env.mainModule.href);
                    coverOptions.urlIsPartOfCoverage = function(url) {
                        // most time we do code coverage test to see how a file is covering all it's dependencies
                        // so checking that the file is the mainLocation or a peer or inside is sufficient
                        return mainURI.includes(url);
                    };

                    var console = options['cover-report-console'];
                    var json = options['cover-report-json'];
                    var html = options['cover-rpeort-html'];
                    if (console || json || html) {
                        var mainNodeURI = mainURI.clone();
                        mainNodeURI.protocol = ''; // remove the file:/// protocol on node
                        mainNodeURI.suffix = '';
                        mainNodeURI.filename += '-coverage';

                        console.log('report directory :', mainNodeURI.href);

                        coverOptions.report = {
                            directory: mainNodeURI.href,
                            console: console,
                            json: json,
                            html: html
                        };
                    }

                    var codecov = options['cover-upload-codecov'];
                    if (codecov) {
                        var token = options['cover-upload-codecov-token'] || process.env.CODECOV_TOKEN;

                        coverOptions.upload = {
                            codecov: {
                                token: token
                            }
                        };
                    }

                    return exports.default.cover(coverOptions);
                });
            });
        }

        return env.importMain(filename).then(function() {
            // module.default();
        });
    });
};
