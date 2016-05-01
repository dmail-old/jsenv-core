import jsenv from 'jsenv';
import URI from 'jsenv/uri';
import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import Action from 'jsenv/action';
import LazyModule from 'jsenv/lazy-module';
import Iterable from 'jsenv/iterable';
import Thenable from 'jsenv/thenable';

jsenv.defaultOptions = {};
jsenv.options = Options.create(jsenv.defaultOptions, jsenv.options);

jsenv.build(function locate() {
    return {
        internalURI: URI.create(this.internalURL),
        baseURI: URI.create(this.baseURL),

        locateFrom: function(data, baseURI, stripFile) {
            var href = URI.create(data, baseURI).href;

            if (stripFile && href.indexOf('file:///') === 0) {
                href = href.slice('file:///'.length);
            }

            return href;
        },

        locate: function(data, stripFile) {
            return this.locateFrom(data, this.baseURI, stripFile);
        },

        locateInternal: function(data, stripFile) {
            return this.locateFrom(data, this.internalURI, stripFile);
        }
    };
});

jsenv.build(function macro() {
    // provide() ok during idle, before, main, after, done
    // config() ok during idle, calling more than once per provider replaces current config function
    // setup() ok during idle, before must be called once per provider, must not be called once exec() was called during before
    // run() ok during idle, before, run must be called once per provider, must not be called once exec() was called during after
    // disable() ok during idle
    // enable() ok during idle

    var Plugin = proto.extend.call(Action, 'Plugin', {
        options: Options.create(Action.options, {
            timeouts: Options.create({
                config: 1000,
                run: 5000,
                end: 5000,
                after: 1000
            })
        }),
        phase: 'idle', // inherited from macro
        configHook: null, // action to perfom to configure this instruction, if null the instruction is not executed
        runHook: null, // action to perform before mainAction
        endHook: null, // action to perform after mainAction

        config(fn) {
            if (this.phase !== 'idle') {
                throw new Error('config() must be called during idle phase');
            }

            this.configHook = fn;
        },

        run(data) {
            if (this.phase !== 'idle' && this.phase !== 'before') {
                throw new Error('setup() must be called during idle or before phase');
            }

            // action can be a string (will import a module)
            // or a function
            if (typeof data === 'string') {
                // only run can come from an imported module, others must be local
                // System.paths['jsenv/plugin/' + this.name] = jsenv.locate(data);
            }

            this.runHook = this.createRunHook(data);
        },

        end(fn) {
            if (this.phase !== 'idle' && this.phase !== 'before' && this.phase !== 'after') {
                throw new Error('run() must be called during idle, before or after phase');
            }

            this.endHook = fn;
        },

        before() {
            var configPromise = this.callHook('configHook');
            if (configPromise) {
                return configPromise.then(function(options) {
                    this.options = Options.create(this.options, options || {});
                    return this.options;
                }.bind(this));
            }

            this.skip('no config');
        },

        fn() {
            return this.phase === 'before' ? this.setupAction() : this.runAction();
        }
    });

    var mainLazyModule = LazyModule.create();
    var mainAction = Action.create({
        name: 'main',
        fn() {
            return mainLazyModule.import();
        }
    });

    var macro = {
        phase: 'idle', // 'idle', 'before', 'main', 'after', 'done'
        providers: [],

        get(name, preventError) {
            var found = this.instructions.find(function(provider) {
                return provider.name === name;
            });
            if (!preventError && !found) {
                throw new Error('no provider named ' + name);
            }
            return found;
        },

        provide(name) {
            if (name && this.get(name, true)) {
                throw new Error('plugin conflict : there is already an plugin named ' + name);
            }

            var plugin = Plugin.create(name);
            plugin.phase = this.phase;

            return plugin;
        },

        plugin(name) {
            return this.get(name);
        },

        config(name, configData) {
            var plugin = this.get(name);
            plugin.config(configData);
            return plugin;
        },

        run(name, runData) {
            var plugin = this.get(name);
            plugin.run(runData);
            return plugin;
        },

        end(name, endData) {
            var plugin = this.get(name);
            plugin.end(endData);
            return plugin;
        },

        getOptions(name) {
            return this.get(name).options;
        },

        setPhase(name) {
            this.phase = name;
            this.plugins.forEach(function(plugin) {
                plugin.phase = name;
            });
        },

        exec() {
            function pipe(methods, bind, initialValue, condition) {
                var iterableMethods = Iterable.map(methods, function(method) {
                    return Thenable.callFunction(method, bind);
                }, bind);

                return Iterable.reduceToThenable(iterableMethods, initialValue, condition);
            }

            return pipe([
                function() {
                    this.setPhase('setup');
                },
                function() {
                    return Iterable.map(this.plugins, function(provider) {
                        jsenv.debug('exec', provider.name);
                        this.current = provider;
                        return provider.exec();
                    }, this);
                },
                function() {
                    this.setPhase('main');
                },
                function() {
                    return this.mainAction.exec();
                },
                function() {
                    this.setPhase('run');
                },
                function() {
                    return Iterable.map(this.plugins, function(provider) {
                        jsenv.debug('exec', provider.name);
                        this.current = provider;
                        return provider.exec();
                    }, this);
                }
            ], this);
        }
    };

    return {
        macro: macro,
        mainAction: mainAction,
        mainLazyModule: mainLazyModule,

        provide(name) {
            return macro.provide(name);
        },

        plugin(name) {
            return macro.get(name);
        },

        getOptions(name) {
            return macro.getOptions(name);
        },

        evalMain(source, sourceURL) {
            this.mainLazyModule.source = source;
            this.mainLazyModule.location = sourceURL || 'anonymous';
            return this.start();
        },

        exportMain(exports) {
            // seems strange to pass an object because this object will not benefit
            // from any polyfill/transpilation etc
            this.mainLazyModule.exports = exports;
            this.mainLazyModule.location = 'anonymous';
            return this.start();
        },

        importMain(moduleLocation) {
            this.mainLazyModule.location = moduleLocation;
            return this.start();
        },

        start() {
            if (!this.mainLazyModule.location) {
                throw new Error('mainLazyModule location must be set before calling start()');
            }

            // locate the mainLazyModule first because some plugin (coverage, test) will need it
            this.mainLazyModule.uri = jsenv.locate(this.mainLazyModule.location);
            this.mainLazyModule.location = this.mainLazyModule.uri;
            this.mainLocation = this.mainLazyModule.uri;
            this.mainURI = URI.create(this.mainLocation);

            // finalement ce que je fais ici c'est jsenv.config('main', function() { return {}});
            // sauf que cette info j'en ai besoin asap

            return macro.exec().then(function() {
                return this.mainLazyModule.exports;
            }.bind(this));
        }
    };
});

jsenv.build(function corePlugins() {
    [
        'exception-handler',
        'agent-more',
        'module-script-name',
        'module-source',
        'module-source-transpiled',
        'module-source-map',
        'exception-stacktrace',
        'module-coverage',
        'module-test',
        'platform-more',
        'language',
        'restart'
    ].forEach(function(pluginName) {
        jsenv.provide(pluginName).run(jsenv.dirname + '/lib/plugins/' + pluginName + '/index.js');
    });

    jsenv.plugin('exception-stacktrace').build(function() {
        this.agent = {type: 'node'};
    });
    // jsenv.actions.get('module-coverage').agent = {type: 'node'};
    // test are compatible with browser too
    // jsenv.actions.get('module-test').agent = {type: 'node'};
});

// example of a feature that does nothing special
jsenv.provide('feature-example')
    .build(function() {
        // optional function executed before feature.config()
        // to build feature initial state
        this.options.foo = 'foo';
    })
    .config(function() {
        // optional promisified function runned before executing feature.run()
        // if not specified the feature is considered disabled
        // returns options for this feature
        // you can later call again config() to erase the current config function
        return {
            foo: 'bar'
        };
    })
    .run(function() {
        // optional promisified function runned before mainModule
    })
    .end(function() {
        // optional promisified function runned after mainModule
    })
;

jsenv.provide('core-plugins')
    .config(function() {
        return {
            enabled: [
                'exception-handler',
                'exception-stacktrace',
                'agent-more',
                'platform-more',
                'language',
                'restart'
            ]
        };
    })
    .run(function() {
        // optional
        this.options.enabled.forEach(function(pluginName) {
            jsenv.config(pluginName);
        });
    })
;
