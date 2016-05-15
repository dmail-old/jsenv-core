module.exports = function run(filename, options) {
    require('../index.js');

    return global.setup().then(function(jsenv) {
        // jsenv.debug('start with params', options);

        if (options.test) {
            jsenv.config('module-test', function() {
                return System.import('jsenv/plugin/module-test').then(function(exports) {
                    return exports.default.test({
                        location: jsenv.mainModule.href
                    });
                });
            });
        }
        if (options.cover) {
            jsenv.config('module-coverage', function() {
                return System.import('jsenv/plugin/module-coverage').then(function(exports) {
                    // most time we do code coverage test to see how a file is covering all it's dependencies
                    // so checking that the file is the mainLocation or a peer or inside is sufficient

                    var mainURI = jsenv.createURI(jsenv.mainModule.href);
                    var mainNodeURI = mainURI.clone();
                    mainNodeURI.protocol = ''; // remove the file:/// protocol on node
                    mainNodeURI.suffix = '';
                    mainNodeURI.filename += '-coverage';

                    console.log('writing report at', mainNodeURI.href);

                    var token = options['cover-codecov-token'] || process.env.CODECOV_TOKEN;

                    var coverOptions = {
                        urlIsPartOfCoverage: function(url) {
                            return mainURI.includes(url);
                        },
                        directory: mainNodeURI.href,
                        console: options['cover-console'],
                        json: options['cover-json'],
                        html: options['cover-html'],
                        codecov: options['cover-codecov'] ? {
                            token: token
                        } : false
                    };

                    return exports.default.cover(coverOptions);
                });
            });
        }

        return jsenv.importMain(filename).then(function() {
            // module.default();
        });
    });
};
