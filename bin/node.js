module.exports = function run(filename, options) {
    require('../index.js');

    return global.setup().then(function(jsenv) {
        // jsenv.debug('start with params', options);

        /*
        function stripTrailingSep(pathname) {
            if (pathname[pathname.length - 1] === '/') {
                pathname = pathname.slice(0, -1);
            }
            return pathname;
        }

        function urlIsSiblingOrDescendantOf(url, otherUrl) {
            url = new global.URL(url, otherUrl);
            otherUrl = new global.URL(otherUrl);

            if (url.protocol !== otherUrl.protocol) {
                return false;
            }
            if (url.host !== otherUrl.host) {
                return false;
            }
            if (url.port !== otherUrl.port) {
                return false;
            }

            var pathname = stripTrailingSep(url.pathname);
            var potentialParentOrSibling = stripTrailingSep(otherUrl.pathname);
            var potentialDirname = potentialParentOrSibling.slice(0, potentialParentOrSibling.lastIndexOf('/'));

            return pathname.startsWith(potentialDirname);
        }
        */

        /*
        jsenv.config(function configLogLevel() {
            jsenv.logLevel = params.verbose ? 'debug' : 'error';
        });
        */
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

                    return exports.default.cover({
                        urlIsPartOfCoverage: function(url) {
                            return jsenv.createURI(jsenv.mainModule.href).includes(url);
                        },
                        directory: jsenv.locateFrom('error-coverage', jsenv.mainModule.href, true),
                        reportConsole: true
                    });
                });
            });
        }

        return jsenv.importMain(filename).then(function() {
            // module.default();
        });
    });
};
