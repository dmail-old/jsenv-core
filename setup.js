import env from 'env';

import URI from 'env/uri';
// import proto from 'jsenv/proto';
import Action from 'env/action';
import LazyModule from 'env/lazy-module';
// import Iterable from 'jsenv/iterable';
// import Thenable from 'jsenv/thenable';

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
    var mainModule = LazyModule.create({
        parentLocation: env.baseURI.href
    });
    var mainAction = Action.create({
        name: 'main',
        uri: env.baseURI,
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
            console.log('importing', moduleLocation);
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

env.config('core-plugins', function() {
    // [
    //     'exception-handler',
    //     'sourcemap-error-stack',
    //     'agent-more',
    //     'platform-more',
    //     'language',
    //     'restart'
    // ].forEach(function(pluginName) {
    //     this.run(pluginName, function() {
    //
    //     });
    // }, this);

    // do not do this if not on node
    // jsenv.mainAction.get('exception-stacktrace').agent = {type: 'node'};
    // jsenv.plugin('exception-stacktrace').build(function() {
    //     this.agent = {type: 'node'};
    // });
    // jsenv.actions.get('module-coverage').agent = {type: 'node'};
    // test are compatible with browser too
    // jsenv.actions.get('module-test').agent = {type: 'node'};
});
