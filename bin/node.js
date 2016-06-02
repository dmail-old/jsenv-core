module.exports = function run(filename, options) {
    require('../index.js');

    return global.jsenv.generate().then(function(env) {
        // jsenv.debug('start with params', options);

        if (options.test) {
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
                    // most time we do code coverage test to see how a file is covering all it's dependencies
                    // so checking that the file is the mainLocation or a peer or inside is sufficient

                    var mainURI = env.createURI(env.mainModule.href);
                    var mainNodeURI = mainURI.clone();
                    mainNodeURI.protocol = ''; // remove the file:/// protocol on node
                    mainNodeURI.suffix = '';
                    mainNodeURI.filename += '-coverage';

                    console.log('report directory :', mainNodeURI.href);

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

        return env.importMain(filename).then(function() {
            // module.default();
        });
    });
};
