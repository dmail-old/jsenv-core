import jsenv from 'jsenv';
import URI from 'jsenv/uri';
// import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import Action from 'jsenv/action';
import LazyModule from 'jsenv/lazy-module';
// import Iterable from 'jsenv/iterable';
// import Thenable from 'jsenv/thenable';

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

jsenv.build(function main() {
    var mainLazyModule = LazyModule.create();
    var mainAction = Action.create({
        name: 'main',
        lazyModule: mainLazyModule,
        main() {
            return this.lazyModule.import();
        }
    });

    return {
        mainAction: mainAction,
        mainLazyModule: mainLazyModule,

        config: mainAction.config.bind(mainAction),
        run: mainAction.run.bind(mainAction),

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

            return mainAction.exec().then(function() {
                return this.mainLazyModule.exports;
            }.bind(this));
        }
    };
});

jsenv.build(function corePluginPaths() {
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
        System.paths['jsenv/plugin/' + pluginName] = jsenv.dirname + '/lib/plugins/' + pluginName + '/index.js';
    });
});

jsenv.config('core-plugins', function() {
    [
        'exception-handler',
        'exception-stacktrace',
        'agent-more',
        'platform-more',
        'language',
        'restart'
    ].forEach(function(pluginName) {
        this.run(pluginName, function() {
            return System.import('jsenv/plugin/' + pluginName);
        });
    }, this);

    // do not do this if not on node
    // jsenv.mainAction.get('exception-stacktrace').agent = {type: 'node'};
    // jsenv.plugin('exception-stacktrace').build(function() {
    //     this.agent = {type: 'node'};
    // });
    // jsenv.actions.get('module-coverage').agent = {type: 'node'};
    // test are compatible with browser too
    // jsenv.actions.get('module-test').agent = {type: 'node'};
});
