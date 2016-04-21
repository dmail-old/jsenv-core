import jsenv from 'jsenv';
import proto from 'jsenv/proto';

let LazyModule = proto.extend('LazyModule', {
    name: undefined, // name that will produce a uri used to create a module from file with SystemJS
    source: undefined, // string used to create a module with SystemJS
    exports: undefined, // object used to create a module with SystemJS

    constructor() {

    },

    import() {
        if (!this.name) {
            throw new Error('LazyModule name must be set before calling lazyModule.load()');
        }

        return Promise.resolve(jsenv.locate(this.name)).then(function(href) {
            if (this.source) {
                jsenv.debug('get mainModule from source string');
                return System.module(this.mainSource, {
                    address: href
                });
            }
            if (this.exports) {
                jsenv.debug('get mainModule from source object');
                var module = System.newModule(this.exports);
                System.set(href, module);
                return module;
            }
            jsenv.debug('get mainModule from source file', href);
            return System.import(href);
        }.bind(this)).then(function(exports) {
            jsenv.debug('module imported', exports);
            this.exports = exports;

            return exports;
        }.bind(this));
    }
});

export default LazyModule;
