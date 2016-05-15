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
            // when installing codecov.io think to put this into localGit
            // and enable localGit feature
//             var execSync = require('child_process').execSync;
// if (!execSync) {
//   var exec = require('execSync').exec;
//   var execSync = function(cmd){
//     return exec(cmd).stdout;
//   };
// }

// module.exports = {

//   configuration : function(){
//     console.log('    No CI Detected. Using git/mercurial');
//     var branch = execSync("git rev-parse --abbrev-ref HEAD || hg branch").toString().trim();
//     if (branch === 'HEAD') {
//       branch = 'master';
//     }
//     var head = execSync("git rev-parse HEAD || hg id -i --debug | tr -d '+'").toString().trim();
//     return {
//       commit : head,
//       branch : branch
//     };
//   }

// };

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

                    var coverOptions = {
                        urlIsPartOfCoverage: function(url) {
                            return mainURI.includes(url);
                        },
                        directory: mainNodeURI.href,
                        console: options['cover-console'],
                        json: options['cover-json'],
                        html: options['cover-html'],
                        codecov: options['cover-codecov'] ? {
                            token: options['cover-codecov-token']
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
