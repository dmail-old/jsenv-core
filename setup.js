import Options from 'env/options';
import Action from 'env/action';
import LazyModule from 'env/lazy-module';
import URI from 'env/uri';

export default function(env) {
    var envAgent = '';
    envAgent = 'env: ';
    envAgent += env.agent.name;
    envAgent += ' ';
    envAgent += env.agent.version;
    envAgent += ' on ';
    envAgent += env.platform.name;
    envAgent += ' ';
    envAgent += env.platform.version;
    envAgent += ' from ';
    envAgent += env.baseURL;
    console.log(envAgent);

    env.build(function locate() {
        return {
            createURI(a, b) {
                return URI.create(a, b);
            },

            internalURI: URI.create(this.internalURL),
            baseURI: URI.create(this.baseURL),

            locateFrom(data, baseURI, stripFile) {
                var href = URI.create(data, baseURI).href;

                if (stripFile && href.indexOf('file:///') === 0) {
                    href = href.slice('file:///'.length);
                }

                return href;
            },

            locate(data, stripFile) {
                return this.locateFrom(data, this.baseURI, stripFile);
            },

            locateInternal(data, stripFile) {
                return this.locateFrom(data, this.internalURI, stripFile);
            }
        };
    });

    env.build(function main() {
        return {
            configMain() {
                var mainModule = LazyModule.create({
                    env: this,
                    parentLocation: this.baseURI.href
                });
                var mainAction = Action.create({
                    name: 'main',
                    uri: this.baseURI,
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

            evalMain(source, sourceURL) {
                this.mainModule.source = source;
                this.mainModule.location = sourceURL || 'anonymous';
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
                    var mainURI = this.createURI(this.mainModule.href);
                    this.mainURI = mainURI;

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

    return Promise.resolve(env);
}
