import jsenv from 'jsenv';
import URI from 'jsenv/uri';
// import Options from 'jsenv/options';
import LazyModule from '../lazy-module/index.js';

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
    var mainModule = LazyModule.create('mainModule', function() {});

    // config are module to run before mainModule so just do mainModule.modules.push(the module)
    // run() are module to run after mainModule so do mainModule.add()

    return {
        mainTask: mainTask,

        config: function(...args) {
            var parentModule = LazyModule.create(...args);
            mainModule.modules.push(parentModule);
            return parentModule;
        },

        run: function(...args) {
            var childModule = LazyModule.create(...args);
            mainModule.add(childModule);
            return childModule;
        },

        evalMain: function(source, sourceURL) {
            mainModule.source = source;
            mainModule.url = sourceURL || './anonymous';
            return this.start();
        },

        exportMain: function(exports) {
            // seems strange to pass an object because this object will not benefit
            // from any polyfill/transpilation etc
            mainModule.exports = exports;
            mainModule.url = './anonymous';
            return this.start();
        },

        importMain: function(moduleLocation) {
            mainModule.url = moduleLocation;
            return this.start();
        },

        start: function() {
            if (!this.mainLocation) {
                throw new Error('mainLocation must be set before calling features.start()');
            }

            mainModule.url = jsenv.locate(mainModule.url);

            return mainModule.start().then(function() {
                return mainModule.module;
            });
        }
    };
});

// var options = Options.create({}, jsenv.options || {});
// depdening on option we'll add default plugin or not

/*
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
*/

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

plugin('module-test');
*/
