import jsenv from 'jsenv';

import Options from 'jsenv/options';

import Reporter from './lib/reporter.js';
import Test from './lib/test.js';

var testService = {
    defaultOptions: Options.create({
        location: null,
        recursive: false,
        reporter: null,
        silent: false,
        json: false
    }),

    install() {
        System.trace = true;
        System.execute = true;
    },

    report(options) {
        var reporter = Reporter.create();

        options.reporter = reporter;
        if (options.json) {
            reporter.use('console-json');
        } else if (options.silent !== true) {
            reporter.use('console-core', options);
        }

        return System.normalize(options.location).then(function(normalizedModuleName) {
            var moduleLoad = System.loads[normalizedModuleName];
            // trace api https://github.com/ModuleLoader/es6-module-loader/blob/master/docs/tracing-api.md
            var exports = moduleLoad.metadata.entry.module.exports;
            var isIndexFile = moduleLoad.name.endsWith('/index.js'); // improve later with Url.filename === 'index.js'
            var hasTest = 'test' in exports;

            if (options.recursive === false && isIndexFile && hasTest === false) {
                options.recursive = true;
            }

            return moduleLoad;
        }).then(function(moduleLoad) {
            function createLoadTest(load) {
                var exports = load.metadata.entry.module.exports;
                var test;

                if ('test' in exports) {
                    var properties = Object.assign({name: load.address}, exports.test);
                    test = Test.create(properties);
                } else {
                    test = Test.create(load.address, function() {
                        this.skip('no test export');
                    });
                }

                return test;
            }

            var test;
            // si on est en mode recursif on doit commencer par tester le moulde le moins dépendants
            // puis tester les modules parents etc
            if (options.recursive) {
                test = Test.create({
                    modules: [jsenv.dirname + '/lib/dependency-graph/index.js'],
                    name: 'testDependencies',
                    main(DependencyGraph) {
                        var loads = System.loads;
                        var graph = DependencyGraph.create();
                        var recusivelyRegisterDependencies = function(load) {
                            var depMap = load.depMap;
                            var loadDependencies = Object.keys(depMap).map(function(dependencyName) {
                                var normalizedDependencyName = depMap[dependencyName];
                                return loads[normalizedDependencyName];
                            }).filter(function(load) {
                                return load.address.startsWith(moduleLoad.address); // improve later with URL.prototype.includes
                            });

                            graph.register(load, loadDependencies);
                            loadDependencies.forEach(function(loadDependency) {
                                recusivelyRegisterDependencies(loadDependency);
                            });
                        };

                        recusivelyRegisterDependencies(moduleLoad);

                        graph.sort().map(createLoadTest).forEach(this.add, this);
                    }
                });
            } else {
                test = createLoadTest(moduleLoad);
            }

            return test;
        }).then(function(test) {
            return test.exec();
        });
    },

    test(options) {
        var customOptions = Options.create(this.defaultOptions, options);

        testService.install(customOptions);
        jsenv.run('module-test-report', function() {
            return testService.report(customOptions);
        });
    }
};

export default testService;
