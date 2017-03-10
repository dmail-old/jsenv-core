// import Options from '@jsenv/options';
// import Action from '@jsenv/action';
// import LazyModule from '@jsenv/lazy-module';
import Url from '@jsenv/url';
import env from '@jsenv/env';

export default function() {
    const userEnv = `env: ${env.agent} on ${env.platform} from ${env.baseURL}`;
    console.log(userEnv);

    env.provide(function locate() {
        return {
            createUrl(a, b) {
                return Url.create(a, b);
            },

            internalUrl: Url.create(env.internalURL),
            baseUrl: Url.create(env.baseURL),

            locateFrom(data, baseUrl, stripFile) {
                var url = Url.create(data, baseUrl);
                var href = url.href;

                if (stripFile && href.indexOf('file:///') === 0) {
                    href = href.slice('file:///'.length);
                }

                return href;
            },

            locate(data, stripFile) {
                return env.locateFrom(data, env.baseUrl, stripFile);
            },

            locateInternal(data, stripFile) {
                return env.locateFrom(data, env.internalUrl, stripFile);
            }
        };
    });
}

/*
env.build(function main() {
    return {
        configMain() {
            var mainModule = LazyModule.create({
                env: this,
                parentLocation: this.baseUrl.href
            });
            var mainAction = Action.create({
                name: 'main',
                url: this.baseUrl,
                module: mainModule,
                main() {
                    return this.module.import();
                }
            });

            this.mainModule = mainModule;
            this.mainAction = mainAction;
        },

        config(...args) {
            return this.mainAction.config(...args);
        },

        run(...args) {
            return this.mainAction.run(...args);
        },

        evalMain(source, sourceUrl) {
            this.mainModule.source = source;
            this.mainModule.location = sourceUrl || 'anonymous';
            return this.start();
        },

        exportMain(exports) {
            // seems strange to pass an object because this object will not benefit
            // from any polyfill/transpilation etc
            this.mainModule.exports = exports;
            this.mainModule.location = 'anonymous';
            return this.start();
        },

        importMain(moduleLocation) {
            this.mainModule.location = moduleLocation;
            return this.start();
        },

        start() {
            if (!this.mainModule.location) {
                throw new Error('mainModule location must be set before calling start()');
            }

            // the first thing we do it to normalize the mainModule location because we'll need it
            return this.mainModule.normalize().then(function() {
                var mainUrl = this.createUrl(this.mainModule.href);
                this.mainUrl = mainUrl;

                return this.mainAction.exec();
            }.bind(this)).then(function() {
                return this.mainAction.result;
            }.bind(this));
        }
    };
});

env.configMain();

env.build(function plugins() {
    var plugins = {
        map: {},

        get(pluginName) {
            return this.map[pluginName];
        },

        add(plugin) {
            // si le plugin a des dépendances, ajoute les avants
            // le truc c'est si le plugin est déjà en cours d'installation il faut le savoir
            // il faudrais donc une sorte de lazyPlugin qu'on met pour savoir s'il existe
            // est ce qu'on pourrais pas réutiliser Action ? y'a LazyModule et une action
            // est lazy par défaut

            var envPluginOptions;
            if (plugin.name in env.options) {
                envPluginOptions = env.options[plugin.name];
            } else {
                envPluginOptions = {};
            }

            var options;
            if (plugin.defaultOptions) {
                options = Options.create(plugin.defaultOptions, envPluginOptions);
            } else {
                options = Options.create(envPluginOptions);
            }

            plugin.options = options;
            // console.log('call plugin installer with', options);
            plugin.install(options);

            this.map[plugin.name] = plugin;
        },

        install(pluginLocation) {
            pluginLocation = env.locate(pluginLocation);

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
*/

// env.plugins.install('./plugin.js');

// var options = env.options;
// if (options.autorun) {
//     env.run(options.autorun);
// }

// var testOptions = options.test;
// if (testOptions) {
//     env.plugins.install('env/module-test');
// }

// var coverOptions = options.cover;
// if (coverOptions) {
//     env.plugins.install('env/module-cover');
// }
