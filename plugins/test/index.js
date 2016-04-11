import engine from 'engine';

import Reporter from '../../lib/test/reporter.js';
import Test from '../../lib/test/test.js';

engine.test = function(moduleName) {
    engine.debug('install test');

    System.trace = true;
    System.execute = true;

    return engine.run(function() {
        var reporter = Reporter.create();
        var options = {
            recursive: false,
            reporter: reporter
        };

        if (options.json) {
            reporter.use('console-json');
        } else if (options.silent !== true) {
            reporter.use('console-core', options);
        }

        return System.normalize(moduleName).then(function(normalizedModuleName) {
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
                    test = Test.create(exports.test);
                } else {
                    test = Test.create(function() {
                        this.skip('no test export');
                    }, load.address);
                }

                if (!test.name) {
                    test.name = load.address;
                }

                return test;
            }

            var test;
            // si on est en mode recursif on doit commencer par tester le moulde le moins dépendants
            // puis tester les modules parents etc
            if (options.recursive) {
                test = Test.create({
                    modules: [engine.dirname + '/lib/dependency-graph/index.js'],
                    name: 'testDependencies',
                    fn: function(DependencyGraph) {
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

                        graph.sort().map(createLoadTest).forEach(this.addTest, this);
                    }
                });
            } else {
                test = createLoadTest(moduleLoad);
            }

            return test;
        }).then(function(test) {
            return test.exec();
        });
    });
};
