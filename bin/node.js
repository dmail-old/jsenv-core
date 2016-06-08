module.exports = function run(filename, options) {
    require('../index.js');

    return global.jsenv.generate().then(function(env) {
        var mainModuleURL = env.locate(filename);
        var promise = Promise.resolve();

        if (options.test && false) {
            promise = promise.then(function() {
                return env.importDefault('env/module-test');
            }).then(function(TestService) {
                return TestService.create({
                    location: mainModuleURL
                });
            }).then(function(testService) {
                env.testService = testService;
                return testService.install(env);
            });
        }

        if (options.cover) {
            promise = promise.then(function() {
                return env.importDefault('env/module-coverage');
            }).then(function(CoverageService) {
                var mainURI = env.createURI(env.mainModule.href);

                return CoverageService.create({
                    urlIsPartOfCoverage: function(url) {
                        // most time we do code coverage test to see how a file is covering all it's dependencies
                        // so checking that the file is the mainLocation or a peer or inside is sufficient
                        return mainURI.includes(url);
                    }
                });
            }).then(function(coverageService) {
                env.coverageService = coverageService;
                return coverageService.install(env);
            });
        }

        var mainPromise = env.importMain(mainModuleURL);

        return mainPromise.then(function(exports) {
            return Promise.resolve().then(function() {
                if (env.testService) {
                    return env.testService.report();
                }
            }).then(function() {
                var coverageService = env.coverageService;

                if (coverageService) {
                    return coverageService.collect().then(function(coverage) {
                        return coverageService.remap(coverage);
                    }).then(function(coverage) {
                        var console = options['cover-report-console'];
                        var json = options['cover-report-json'];
                        var html = options['cover-rpeort-html'];

                        if (console || json || html) {
                            var mainNodeURI = env.createURI(mainModuleURL);
                            mainNodeURI.protocol = ''; // remove the file:/// protocol on node
                            mainNodeURI.suffix = '';
                            mainNodeURI.filename += '-coverage';

                            console.log('report directory :', mainNodeURI.href);

                            coverageService.options.report = {
                                directory: mainNodeURI.href,
                                console: console,
                                json: json,
                                html: html
                            };

                            return coverageService.report(coverage).then(function() {
                                return coverage;
                            });
                        }
                        return coverage;
                    }).then(function(coverage) {
                        var codecov = options['cover-upload-codecov'];
                        if (codecov) {
                            var token = options['cover-upload-codecov-token'] || process.env.CODECOV_TOKEN;

                            coverageService.options.upload = {
                                codecov: {
                                    token: token
                                }
                            };

                            return coverageService.upload(coverage, token);
                        }
                    });
                }
            }).then(function() {
                return exports;
            });
        });
    });
};
