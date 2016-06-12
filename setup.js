import env from 'env';
import Options from 'env/options';

env.configMain();

env.build(function plugins() {
    var plugins = {
        map: {},

        get(pluginName) {
            return this.map[pluginName];
        },

        add(plugin) {
            var envPluginOptions;
            if (env.options.plugins && plugin.name in env.options.plugins) {
                envPluginOptions = env.options.plugins[plugin.name];
            } else {
                envPluginOptions = {};
            }

            var options;
            if (plugin.defaultOptions) {
                options = Options.create(Options.create(plugin.defaultOptions), envPluginOptions);
            } else {
                options = Options.create(envPluginOptions);
            }

            plugin.options = options;
            // console.log('call plugin installer with', options);
            plugin.install(options);

            this.map[plugin.name] = plugin;
        },

        install(pluginLocation) {
            return env.config(function() {
                return env.importDefault(pluginLocation).then(function(plugin) {
                    // console.log('adding plugin', plugin);
                    return env.plugins.add(plugin);
                });
            });
        }
    };

    return {
        plugins: plugins
    };
});

var options = env.options;
if (options.autorun) {
    env.run(options.autorun);
}

var testOptions = options.test;
if (testOptions) {
    env.plugins.install('env/module-test');
}

var coverOptions = options.cover;
if (coverOptions) {
    env.plugins.install('env/module-cover');
}

