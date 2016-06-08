import 'env/agent-more';
import 'env/platform-more';
import 'env/language';
import 'env/restart';

// do something to setup your env

import URI from 'env/uri';
// import proto from 'jsenv/proto';
// import Iterable from 'jsenv/iterable';
// import Thenable from 'jsenv/thenable';
import sources from 'env/file-source';

export default function(jsenv) {
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
