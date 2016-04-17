import jsenv from 'jsenv';
import URI from 'jsenv/uri';
// import Options from 'jsenv/options';
import TaskChain from './task-chain.js';

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
jsenv.taskChain = TaskChain.create();

jsenv.provide(function mainTask() {
    var mainTask = this.taskChain.createTask('main', function() {
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

    this.taskChain.add(mainTask);

    return {
        mainTask: mainTask,

        config: function(...args) {
            var task = this.taskChain.createTask(...args);
            return this.taskChain.insert(task, mainTask);
        },

        run: function(...args) {
            var task = this.taskChain.createTask(...args);
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

            return this.taskChain.start().then(function() {
                return jsenv.mainModule;
            });
        }
    };
});

// var options = Options.create({}, jsenv.options || {});
// depdening on option we'll add default plugin or not

jsenv.config({
    url: './plugins/exception-handler/index.js',
    after: function(module) {
        var exceptionHandler = module.default;

        exceptionHandler.install(jsenv);
        exceptionHandler.enable();
    }
});

jsenv.config({
    url: './plugins/agent-more/#{jsenv|platform.type}.js'
});

jsenv.config({
    url: './plugins/module-script-name/index.js'
});

jsenv.config({
    url: './plugins/module-source/index.js'
});

jsenv.config({
    url: './plugins/module-source-transpiled/index.js'
});

jsenv.config({
    url: './plugins/module-source-map/index.js'
});

// only if node
jsenv.config({
    url: './plugins/agent-node/exception-stacktrace/index.js'
});
// only if node
jsenv.config({
    url: './plugins/agent-node/module-coverage/index.js'
});

jsenv.config({
    url: './plugins/platform-more/#{jsenv|platform.type}.js'
});

jsenv.config({
    url: './plugins/language/index.js'
});

jsenv.config({
    url: './plugins/restart/index.js'
});

jsenv.config({
    url: './plugins/restart/index.js'
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
plugin('agent-config', {
    locate: function() {
        return features.dirname + '/plugins/agent-' + features.agent.type + '/index.js';
    }
});

plugin('module-test');
*/
