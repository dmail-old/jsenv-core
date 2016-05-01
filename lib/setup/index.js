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

    var Provider = proto.extend('Provider', {
        phase: 'idle', // inherited from macro
        configAction: null, // action to perfom to configure this instruction, if null the instruction is not executed
        setupAction: null, // action to perform before mainAction
        teardownAction: null, // action to perform after mainAction

        config(action) {
            if (this.phase !== 'idle') {
                throw new Error('config() must be called during idle phase');
            }

            this.configAction = action;
        },

        setup(action) {
            if (this.phase !== 'idle' && this.phase !== 'before') {
                throw new Error('setup() must be called during idle or before phase');
            }

            this.setupAction = action;
        },

        run(action) {
            if (this.phase !== 'idle' && this.phase !== 'before' && this.phase !== 'after') {
                throw new Error('run() must be called during idle, before or after phase');
            }

            this.runAction = action;
        },

        exec() {
            var optionsPromise = this.optionsPromise;

            if (!optionsPromise) {
                if (this.configAction) {
                    optionsPromise = Thenable.callFunction(this.configAction, this).then(function(options) {
                        this.options = Options.create(this.options, options || {});
                        return this.options;
                    }.bind(this));
                    this.optionsPromise = optionsPromise;
                } else {
                    return Promise.resolve();
                }
            }

            return optionsPromise.then(function(options) {
                return this.phase === 'before' ? this.setupAction(options) : this.runAction(options);
            }.bind(this));
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

        getOptions(name) {
            return this.get(name).options;
        },

        provide(name, setupAction) {
            if (name && this.get(name, true)) {
                throw new Error('provider conflict : there is already an provider named ' + name);
            }
            // provide on peut encore le faire même en phase config ou run, par contre on crée alors une instruction
            // dans la même phase que la phase actuelle, ou tout simplement on ne peut plus provide en phase de run

            var provider = Provider.create(name);
            provider.phase = this.phase;
            provider.setup(setupAction);
            return provider;
        },

        config(name, configAction) {
            var provider = this.get(name);
            provider.config(configAction);
            return provider;
        },

        run(name, afterAction) {
            var provider = this.get(name);
            provider.run(afterAction);
            return provider;
        },

        setPhase(name) {
            this.phase = name;
            this.providers.forEach(function(provider) {
                provider.phase = name;
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
                    return Iterable.map(this.providers, function(provider) {
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
                    return Iterable.map(this.providers, function(provider) {
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

        provide(name, ...args) {
            return macro.provide(name, Action.create(...args));
        },

        config(name, ...args) {
            return macro.config(name, Action.create(...args));
        },

        run(name, ...args) {
            return macro.run(name, Action.create(...args));
        },

        getOptions(name) {
            return macro.getOptions(name);
        },

        // plugin is a specific provide
        plugin(pluginName, location) {
            var pluginLazyModule = LazyModule.create();
            pluginLazyModule.location = location;
            // give a shortcut to access the plugin in a reliable way
            System.paths['jsenv/plugin/' + pluginName] = jsenv.locate(location);

            // console.log('short cut to', System.paths['jsenv/plugin/' + name], 'from', 'jsenv/plugin/' + name);

            return this.provide(pluginName, {
                fn() {
                    return pluginLazyModule.import();
                }
            });
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
        var pluginAction = jsenv.plugin(pluginName, jsenv.dirname + '/lib/plugins/' + pluginName + '/index.js');
        return pluginAction;
    });

    jsenv.actions.get('exception-stacktrace').agent = {type: 'node'};
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
    .run(function(options) {
        // optional promisified function runned before mainModule
        return options;
    })
    .end(function(options) {
        // optional promisified function runned after mainModule
        return options;
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
    .run(function(options) {
        // optional
        options.enabled.forEach(function(pluginName) {
            jsenv.config(pluginName);
        });
    })
;
