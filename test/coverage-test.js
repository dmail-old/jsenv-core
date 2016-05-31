import jsenv from 'jsenv';

var env = Object.getPrototypeOf(jsenv);

env.generate({logLevel: 'info'}).then(function(myEnv) {
    myEnv.config(function() {
        return myEnv.import('jsenv/module-coverage').then(function(exports) {
            var coverage = exports.default.create({
                urlIsPartOfCoverage(url) {
                    return url.includes('anonymous');
                }
            });

            this.coverage = coverage;

            return coverage.install(this);
        }.bind(this));
    });

    return myEnv.evalMain('export default true', 'anonymous').then(function() {
        // let source = myEnv.FileSource.create(myEnv.locate('anonymous'));

        console.log(myEnv.coverage.value);
    });
});
