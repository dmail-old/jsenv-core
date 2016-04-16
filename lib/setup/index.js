import jsenv from 'jsenv';
import URI from 'jsenv/uri';
import taskChain from './task-chain.js';

// we must also provide es6 polyfills (Map, Set, Iterator, ...)
// var options = jsenv.options;

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
jsenv.taskChain = taskChain;

jsenv.provide(function mainTask() {
    var mainTask = this.taskChain.create('main', function() {
        var mainModulePromise;

        if (this.mainSource) {
            this.debug('get mainModule from source string');
            mainModulePromise = System.module(this.mainSource, {
                address: this.mainLocation
            });
        } else if (this.mainModule) {
            this.debug('get mainModule from source object');
            this.mainModule = System.newModule(this.mainModule);
            System.set(this.mainLocation, this.mainModule);
            mainModulePromise = Promise.resolve(this.mainModule);
        } else {
            this.debug('get mainModule from source file', this.mainLocation);
            mainModulePromise = System.import(this.mainLocation);
        }

        return mainModulePromise.then(function(mainModule) {
            this.debug('mainModule imported', mainModule);
            this.mainModule = mainModule;
            return mainModule;
        }.bind(this));
    }.bind(this));

    this.taskChain.insert(mainTask, this.taskChain.tail);

    return {
        mainTask: mainTask,

        config: function() {
            var task = this.taskChain.create.apply(null, arguments);
            return this.taskChain.insert(task, mainTask);
        },

        run: function() {
            var task = this.taskChain.create.apply(null, arguments);
            return this.taskChain.add(task);
        },

        evalMain: function(source, sourceURL) {
            this.mainSource = source;
            this.mainLocation = sourceURL || './anonymous';
            return this.start();
        },

        exportMain: function(moduleExports) {
            // seems strange to pass an object because this object will not benefit
            // from any polyfill/transpilation etc
            this.mainModule = moduleExports;
            this.mainLocation = './anonymous';
            return this.start();
        },

        importMain: function(moduleLocation) {
            this.mainLocation = moduleLocation;
            return this.start();
        },

        start: function() {
            if (!this.mainLocation) {
                throw new Error('mainLocation must be set before calling features.start()');
            }

            this.mainLocation = jsenv.locate(this.mainLocation);

            return this.taskChain.head.start().then(function() {
                return jsenv.mainModule;
            });
        }
    };
});

/*
jsenv.provide(function plugin() {
    return {
        plugin: function(name, properties) {
            var task = jsenv.config(name);
            task.locate = function() {
                return jsenv.dirname + '/plugins/' + this.name + '/index.js';
            };
            task.populate(properties);
            return task;
        }
    };
});
*/
// setImmediate, Promise, URL, System, URI, locate are now available

/*
plugin('es6', {
    locate: function() {
        var polyfillLocation;

        if (features.isBrowser()) {
            polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
        } else {
            polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';
        }

        return features.dirname + '/' + polyfillLocation;
    }
});

plugin('exception-handler');

plugin('module-internal');

plugin('module-source');

plugin('module-script-name');

plugin('module-source-transpiled');

plugin('module-sourcemap');

plugin('agent-config', {
    locate: function() {
        return features.dirname + '/plugins/agent-' + features.agent.type + '/index.js';
    }
});

plugin('module-test');
*/
