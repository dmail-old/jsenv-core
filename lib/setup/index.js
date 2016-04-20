import jsenv from 'jsenv';
import URI from 'jsenv/uri';
import proto from 'jsenv/proto';
// import Options from 'jsenv/options';
import LazyModule from '../lazy-module/index.js';
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

    var Action = proto.extend('Action', {
        name: '',

        constructor(properties) {
            Object.assign(this, properties);
        },

        fn() {
            if (this.lazyModule) {
                return this.lazyModule.exec();
            }
            // this action is a noop
        },

        exec() {
            jsenv.debug('executing action', this.name);

            return this.fn();
        }
    });

    var actions = [];
    var mainLazyModule = LazyModule.create();
    var mainAction = Action.create({
        name: 'main',
        lazyModule: mainLazyModule
    });
    actions.push(mainAction);
    actions.add = function(action, phase) {
        // s'il y a acutellement une action en cours je me met juste après celle-ci, sinon avant mainAction
        if (phase === 'config') {
            actions.splice(actions.indexOf(mainAction), 0, action);
        } else {
            actions.push(action);
        }
    };
    actions.start = function() {
        var actionPromises = Iterable.map(actions, function(action) {
            return action.exec();
        }, this);
        return Iterable.reduceToThenable(actionPromises);
    };

    return {
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

        plugin(name, url) {
            var pluginLazyModule = LazyModule.create();
            pluginLazyModule.name = url;
            var pluginAction = Action.create({
                name: name,
                lazyModule: pluginLazyModule
            });

            // give a shortcut to access the plugin in a reliable way
            System.paths['jsenv/plugin/' + name] = jsenv.locate(url).href;

            actions.add(pluginAction, 'config');
            return pluginAction;
        },

        evalMain(source, sourceURL) {
            this.mainLazyModule.source = source;
            this.mainLazyModule.name = sourceURL || 'anonymous';
            return this.start();
        },

        exportMain(exports) {
            // seems strange to pass an object because this object will not benefit
            // from any polyfill/transpilation etc
            this.mainLazyModule.exports = exports;
            this.mainLazyModule.name = 'anonymous';
            return this.start();
        },

        importMain(moduleLocation) {
            this.mainLazyModule.name = moduleLocation;
            return this.start();
        },

        start() {
            if (!this.mainLazyModule.name) {
                throw new Error('mainLazyModule name must be set before calling start()');
            }

            // locate the mainLazyModule first because some plugin (coverage, test) will need it
            this.mainLazyModule.uri = jsenv.locate(this.mainLazyModule.name);
            this.mainLazyModule.name = this.mainLazyModule.uri;

            return actions.start().then(function() {
                return this.mainLazyModule.module;
            }.bind(this));
        }
    };
});

// var options = Options.create({}, jsenv.options || {});
// depdening on option we'll add default plugin or not

/*
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
        location: './plugins/' + pluginName + '/index.js'
    });
});

jsenv.plugins.get('agent-more').location = './plugins/agent-more/' + jsenv.platform.type + '.js';
jsenv.plugins.get('platform-more').location = './plugins/platform-more/' + jsenv.platform.type + '.js';
jsenv.plugins.get('exception-stacktrace').agent = {type: 'node'};
jsenv.plugins.get('module-coverage').agent = {type: 'node'};
jsenv.plugins.get('module-test').agent = {type: 'node'};
*/
