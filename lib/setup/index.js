import jsenv from 'jsenv';
import URI from 'jsenv/uri';
import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import Action from 'jsenv/action';
import LazyModule from 'jsenv/lazy-module';
import Iterable from 'jsenv/iterable';

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
    // three phase
    // provide : provide some action disabled by default
    // config : configure provided action that will be executed before executing mainModule
    // run: do more stuff related to action after mainModule is executed
    // provide(), config(), run() are used to register async functions during corresponding phase

    // can we call config() & run() more than once per instruction ?
    // what do we do when we call config() once module-test config() phase is passed ? (we're still in the config phase but
    // the config phase for this instruction is done, we could reproduce a config phase for this instruction
    // but that would increase complexity while not being usefull so we have to throw too
    // config is executed before provide that gets the output of config, run will get the output of config too but will
    // be runned after main task

    var Instruction = proto.extend('Instruction', {
        phase: null, // 'config', 'before', 'after', 'idle'
        configAction: null, // action to perfom to configure this instruction, if null the instruction is not executed
        beforeAction: null, // action to perform before mainAction
        afterAction: null // action to perform after mainAction
    });

    // macro is by default in the config phase
    var macro = {
        phase: 'before', // 'config', 'before', 'main', 'after', 'idle'
        instructions: [],

        get(instructionName, preventError) {
            var found = this.instructions.find(function(instruction) {
                return instruction.name === instructionName;
            });
            if (!preventError && !found) {
                throw new Error('no instruction named ' + instructionName);
            }
            return found;
        },

        getOptions(instructionName) {
            return this.get(instructionName).options;
        },

        provide(instructionName, beforeAction) {
            if (this.phase !== 'provide') {
                throw new Error('macro.provide() must be called during provide (current phase: ' + this.phase + ')');
            }
            if (instructionName && this.get(instructionName, true)) {
                throw new Error('instruction name conflict : there is already an instruction named ' + instructionName);
            }
            // provide on peut encore le faire même en phase config ou run, par contre on crée alors une instruction
            // dans la même phase que la phase actuelle, ou tout simplement on ne peut plus provide en phase de run

            var instruction = Instruction.create(instructionName);
            instruction.before(beforeAction);
            return instruction;
        },

        config(instructionName, configAction) {
            if (this.phase === 'run') {
                throw new Error('macro.config() must be called before run phase');
            }

            var instruction = this.get(instructionName);
            instruction.config(configAction);
            return instruction;
        },

        run(instructionName, afterAction) {
            if (this.phase === 'idle') {
                throw new Error('macro.run() must be called before idle phase');
            }

            var instruction = this.get(instructionName);
            instruction.after(afterAction);
            return instruction;
        },

        exec() {
            var instructionPromises = Iterable.map(this.instructions, function(instruction) {
                jsenv.debug('exec', instruction.name);
                this.current = instruction;
                return instruction.exec();
            }, this);
            return Iterable.reduceToThenable(instructionPromises);
        }
    };

    var mainLazyModule = LazyModule.create();
    var mainAction = Action.create({
        name: 'main',
        fn() {
            return mainLazyModule.import();
        }
    });

    return {
        macro: macro,
        mainAction: mainAction,
        mainLazyModule: mainLazyModule,

        provide(instructionName, ...args) {
            return macro.provide(instructionName, Action.create(...args));
        },

        config(instructionName, ...args) {
            return macro.config(instructionName, Action.create(...args));
        },

        run(instructionName, ...args) {
            return macro.run(instructionName, Action.create(...args));
        },

        getOptions(instructionName) {
            return macro.getOptions(instructionName);
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

// create the use-core-plugins instruction, you can later do
// jsenv.disable('use-core-plugins') to disable this instruction
// jsenv.config('use-core-plugins', function() {}); to update instruction options
// jsenv.instruct will by default create an enabled instruction while jsenv.plugin will create a disabled one
jsenv.instruct(
    'use-core-plugins',
    // before action
    function(options) {
        options.enabled.forEach(function(pluginName) {
            jsenv.config(pluginName);
        });
    },
    // optional options action
    function() {
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
    }
);
