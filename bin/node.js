module.exports = function run(filename, options) {
    require('../index.js');

    return global.jsenv.generate().then(function(env) {
        var mainModuleURL = env.locate(filename);

        if (options.test && false) {
            env.config(function() {
                return this.importDefault('env/module-test').then(function(TestPlugin) {
                    return TestPlugin.create({
                        location: mainModuleURL
                    });
                }).then(function(testPlugin) {
                    this.testPlugin = testPlugin;
                    return testPlugin.install();
                }.bind(this));
            });

            env.run(function() {
                return this.testService.report();
            });
        }

        return env.importMain(mainModuleURL);
    });
};
