import env from 'env';

import Action from 'env/action';
import LazyModule from 'env/lazy-module';

env.build(function main() {
    return {
        configMain() {
            var mainModule = LazyModule.create({
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
            console.log('importing', moduleLocation);
            this.mainModule.location = moduleLocation;
            return this.start();
        },

        start() {
            if (!this.mainModule.location) {
                throw new Error('mainModule location must be set before calling start()');
            }

            // the first thing we do it to normalize the mainModule location because we'll need it
            return this.mainModule.normalize().then(function() {
                return this.mainAction.exec();
            }.bind(this)).then(function() {
                return this.mainAction.result;
            }.bind(this));
        }
    };
});

env.configMain();
