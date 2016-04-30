import jsenv from 'jsenv';
import URI from 'jsenv/uri';
// import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import Action from 'jsenv/action';
import LazyModule from 'jsenv/lazy-module';
import Iterable from 'jsenv/iterable';

jsenv.defaultOptions = {

};
jsenv.options = Options.create(jsenv.defaultOptions, jsenv.options);

jsenv.provide(function locate() {
    return {
        internalURI: URI.create(this.internalURL),
        baseURI: URI.create(this.baseURL),

        locateFrom: function(data, baseURI, stripFile) {
            var href = URI.create(this.cleanPath(data), this.cleanPath(baseURI)).href;

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

jsenv.provide(function mainTask() {
    // config() is a list of async function executed before the mainLazyModule
    // run() is a list of async function executed after the mainLazyModule
    // plugin() ca sera du sucre syntaxique qui va faire une action mise dans config qui charge un fichier

    var actions = [];
    var mainLazyModule = LazyModule.create();
    var mainAction = Action.create({
        name: 'main',
        fn() {
            return mainLazyModule.import();
        }
    });
    actions.push(mainAction);
    actions.get = function(name, preventError) {
        var found = this.find(function(action) {
            return action.name === name;
        });
        if (!preventError && !found) {
            throw new Error('no action named ' + name);
        }
        return found;
    };
    actions.add = function(action, phase = 'config') {
        if (action.name && this.get(action.name, true)) {
            throw new Error('action name conflict : there is already an action named ' + action.name);
        }
        // throw error if action name is already taken

        if (phase === 'config') {
            if (mainAction.pending || mainAction.settled) {
                throw new Error('cannot add action to config phase because config phase is over');
            }

            let index;
            if (this.current) {
                index = this.indexOf(this.current) + 1;
            } else {
                index = this.indexOf(mainAction);
            }

            actions.splice(index, 0, action);
        } else if (phase === 'run') {
            let index;

            // mainAction must be settled to consider we're in the run phase and this.current is a run action calling jsenv.run
            if (mainAction.settled && this.current) {
                index = this.indexOf(this.current) + 1;
            } else {
                index = this.length;

                if (mainAction.settled && this[index - 1].settled) {
                    throw new Error('cannot add action to run phase because run phase is over');
                }
            }

            actions.splice(index, 0, action);
        } else {
            throw new Error('phase must be config or run');
        }
    };
    actions.start = function() {
        var actionPromises = Iterable.map(actions, function(action) {
            jsenv.debug('exec', action.name);
            this.current = action;
            return action.exec();
        }, this);
        return Iterable.reduceToThenable(actionPromises);
    };

    return {
        actions: actions,
        mainAction: mainAction,
        mainLazyModule: mainLazyModule,

        config(...args) {
            var action = Action.create(...args);
            actions.add(action, 'config');
            return action;
        },

        run(...args) {
            var action = Action.create(...args);
            actions.add(action, 'run');
            return action;
        },

        plugin(pluginName, location) {
            var pluginLazyModule = LazyModule.create();
            pluginLazyModule.location = location;
            // give a shortcut to access the plugin in a reliable way
            System.paths['jsenv/plugin/' + pluginName] = jsenv.locate(location);

            // console.log('short cut to', System.paths['jsenv/plugin/' + name], 'from', 'jsenv/plugin/' + name);

            var action = this.config({
                name: pluginName,
                options: Options.create(Action.options, {disabled: true}),
                fn() {
                    if (this.options.disabled) {
                        this.skip('disabled');
                    }

                    return pluginLazyModule.import();
                }
            });

            return action;
        },

        getOptions(actionName) {
            return actions.get(actionName).options;
        },

        use(pluginName, options) {
            var action = actions.get(pluginName);
            action.options.disabled = false;
            action.options = Options.create(action.options, options || {});
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

            return actions.start().then(function() {
                return this.mainLazyModule.exports;
            }.bind(this));
        }
    };
});

jsenv.provide(function corePlugins() {
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

jsenv.config(function useCorePlugins() {
    // is there some plugin we use by default ?
    jsenv.use('exception-handler');
    jsenv.use('exception-stacktrace');
    jsenv.use('agent-more');
    jsenv.use('platform-more');
    jsenv.use('language');
    jsenv.use('restart');
});
