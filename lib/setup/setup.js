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
        createURI(a, b) {
            return URI.create(a, b);
        },

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
    var mainModule = LazyModule.create({
        parentLocation: jsenv.baseURI.href
    });
    var mainAction = Action.create({
        name: 'main',
        module: mainModule,
        main() {
            return this.module.import();
        }
    });

    return {
        mainAction: mainAction,
        mainModule: mainModule,

        config: mainAction.config.bind(mainAction),
        run: mainAction.run.bind(mainAction),

        evalMain(source, sourceURL) {
            mainModule.source = source;
            mainModule.location = sourceURL || 'anonymous';
            return this.start();
        },

        exportMain(exports) {
            // seems strange to pass an object because this object will not benefit
            // from any polyfill/transpilation etc
            mainModule.exports = exports;
            mainModule.location = 'anonymous';
            return this.start();
        },

        importMain(moduleLocation) {
            mainModule.location = moduleLocation;
            return this.start();
        },

        start() {
            if (!mainModule.location) {
                throw new Error('mainModule location must be set before calling start()');
            }

            // the first thing we do it to normalize the mainModule location because we'll need it
            return mainModule.normalize().then(function() {
                return mainAction.exec();
            }).then(function() {
                return mainAction.result;
            });
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
