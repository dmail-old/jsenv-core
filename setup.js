import env from 'env';

env.configMain();

var options = env.options;

if (options.autorun) {
    env.run(options.autorun);
}

var coverOptions = options.cover;

// this is part of the options you can pass when generating an env, this code may belong to the module-coverage stuff
// that will auto plugin into the current env when imported
if (coverOptions) {
    env.config(function() {
        return env.importDefault('env/module-coverage').then(function(CoveragePlugin) {
            var mainURI = env.createURI(env.mainModule.href);

            env.mainURI = mainURI;

            return CoveragePlugin.create({
                urlIsPartOfCoverage: function(url) {
                    // most time we do code coverage test to see how a file is covering all it's dependencies
                    // so checking that the file is the mainLocation or a peer or inside is sufficient
                    return mainURI.includes(url);
                }
            });
        }).then(function(coveragePlugin) {
            env.coveragePlugin = coveragePlugin;
            return coveragePlugin.install();
        });
    });

    env.run(function() {
        var coveragePlugin = env.coveragePlugin;

        return coveragePlugin.collect().then(function(coverage) {
            return coveragePlugin.remap(coverage);
        }).then(function(coverage) {
            var console = coverOptions.console;
            var json = coverOptions.json;
            var html = coverOptions.html;

            if (console || json || html) {
                var mainURIClone = env.mainURI.clone();
                mainURIClone.protocol = ''; // remove the file:/// protocol on node
                mainURIClone.suffix = '';
                mainURIClone.filename += '-coverage';

                console.log('report directory :', mainURIClone.href);

                coveragePlugin.options.report = {
                    directory: mainURIClone.href,
                    console: console,
                    json: json,
                    html: html
                };

                return coveragePlugin.report(coverage).then(function() {
                    return coverage;
                });
            }
            return coverage;
        }).then(function(coverage) {
            var codecov = coverOptions.codecov;
            if (codecov) {
                var token = coverOptions.codecov.token || process.env.CODECOV_TOKEN;

                coveragePlugin.options.upload = {
                    codecov: {
                        token: token
                    }
                };

                return coveragePlugin.upload(coverage, token);
            }
        });
    });
}
