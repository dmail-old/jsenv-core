import 'env/language';
import 'env/restart';

// do something to setup your env

import URI from 'env/uri';
// import proto from 'jsenv/proto';
// import Iterable from 'jsenv/iterable';
// import Thenable from 'jsenv/thenable';
import sources from 'env/file-source';

import Action from 'env/action';
import LazyModule from 'env/lazy-module';

export default function(jsenv) {
    var userAgent = 'jsenv ';
    userAgent += jsenv.agent.name;
    userAgent += '/';
    userAgent += jsenv.agent.version;
    userAgent += ' (';
    userAgent += jsenv.platform.name;
    userAgent += ' ';
    userAgent += jsenv.platform.version;
    userAgent += ')';
    console.log(userAgent);
    console.log(jsenv.baseURL);

    jsenv.build(function locate() {
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

    jsenv.build(function main() {
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

    jsenv.defineSupportDetector('error-stack-sourcemap', function() {
        if (this.isNode()) {
            return false;
        }
        if (this.isBrowser()) {
            if (this.agent.name === 'chrome') {
                return true;
            }
            return false;
        }
        return false;
    });

    jsenv.sources = sources;

    var installPromise = Promise.resolve();

    if (jsenv.support('error-stack-sourcemap') === false) {
        installPromise = installPromise.then(function() {
            return jsenv.import('env/remap-error-stack');
        });
    }
    // prepare() the language preferences to be able to call jsenv.language.best() sync
    if (true) { // eslint-disable-line no-constant-condition
        installPromise = installPromise.then(function() {
            return jsenv.language.prepare();
        });
    }

    return installPromise;
}
