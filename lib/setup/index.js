import jsenv from 'jsenv';
import URI from 'jsenv/uri';
// import proto from 'jsenv/proto';
// import Options from 'jsenv/options';
import Action from './action.js';
import LazyModule from './lazy-module.js';
import Iterable from 'jsenv/iterable';

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
    actions.add = function(action, phase = 'config') {
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
            if (this.current) {
                index = this.indexOf(this.current) + 1;
            } else {
                index = this.length - 1;

                if (this[index].settled) {
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
            this.current = action;
            return action.exec();
        }, this);
        return Iterable.reduceToThenable(actionPromises);
    };
    actions.get = function(name) {
        var found = this.find(function(action) {
            return action.name === name;
        });
        if (!found) {
            throw new Error('no action named ' + name);
        }
        return found;
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

        plugin(name, properties) {
            var pluginLazyModule = LazyModule.create(properties);
            // give a shortcut to access the plugin in a reliable way
            System.paths['jsenv/plugin/' + name] = jsenv.locate(pluginLazyModule.location);

            // console.log('short cut to', System.paths['jsenv/plugin/' + name], 'from', 'jsenv/plugin/' + name);

            return this.config({
                name: name,
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

            return actions.start().then(function() {
                return this.mainLazyModule.exports;
            }.bind(this));
        }
    };
});

// var options = Options.create({}, jsenv.options || {});
// depdening on option we'll add default plugin or not

[
    'exception-handler',
    'agent-more',
    'module-script-name',
    'module-source',
    'module-source-transpiled',
    'module-source-map',
    'exception-stacktrace',
    'module-coverage',
    'platform-more',
    'language',
    'restart'
].forEach(function(pluginName) {
    jsenv.plugin(pluginName, {
        location: './lib/plugins/' + pluginName + '/index.js'
    });
});

jsenv.actions.get('exception-stacktrace').agent = {type: 'node'};
jsenv.actions.get('module-coverage').agent = {type: 'node'};
// jsenv.actions.get('module-test').agent = {type: 'node'};
