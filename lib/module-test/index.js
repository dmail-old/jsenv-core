import jsenv from 'jsenv';

import Options from 'jsenv/options';

import Reporter from './lib/reporter.js';
import Test from './lib/test.js';

var testService = {
    defaultOptions: Options.create({
        location: null,
        recursive: false,
        reporter: null,
        reportConsole: true,
        reportJSON: false
    }),

    install() {
        System.trace = true;
        System.execute = true;
    },

    report(options) {
        var reporter = Reporter.create();

        options.reporter = reporter;
        if (options.reportJSON) {
            reporter.use('console-json');
        } else if (options.reportConsole) {
            reporter.use('console-core');
        }

        return System.normalize(options.location).then(function(normalizedModuleName) {
            var moduleLoad = System.loads[normalizedModuleName];
            // trace api https://github.com/ModuleLoader/es6-module-loader/blob/master/docs/tracing-api.md
            var exports = moduleLoad.metadata.entry.module.exports;
            var isIndexFile = moduleLoad.name.endsWith('/index.js'); // improve later with uri.filename === 'index.js'
            var hasTest = 'test' in exports;

            if (options.recursive === false && isIndexFile && hasTest === false) {
                options.recursive = true;
            }

            return moduleLoad;
        }).then(function(moduleLoad) {
            function getTestExports(load) {
                var exports = load.metadata.entry.module.exports;
                if ('test' in exports) {
                    return exports.test;
                }
                return null;
            }

            // si on est en mode recursif on doit commencer par tester le moulde le moins dépendants
            // puis tester les modules parents etc
            if (options.recursive === false) {
                var testExports = getTestExports(moduleLoad);
                var properties = {
                    uri: jsenv.createURI(options.location),
                    name: options.location,
                    options: Options.create(Test.options, options)
                };
                if (testExports) {
                    Object.assign(properties, testExports);
                } else {
                    properties.skipReason = 'no test exported';
                }

                return Test.create(properties);
            }

            // au lieu de parcourir recursivement on va recursivement créer des tests pour chaque fichier
            // parce que là on assume qu'on fait récursivemen tout alors qu'il ne faudrais faire récusrivement que si le fichier
            // n'exporte pas de test, ou on pourrait apeller ça recursive = 'auto'

            return System.import('jsenv/dependency-graph').then(function(DependencyGraph) {
                return DependencyGraph.default;
            }).then(function(DependencyGraph) {
                return Test.create({
                    uri: jsenv.createURI(options.location),
                    options: Options.create(Test.options, options),
                    name: options.location,
                    main() {
                        var moduleURI = jsenv.createURI(moduleLoad.address);
                        var loads = System.loads;
                        var graph = DependencyGraph.create();

                        function recursivelyRegisterDependencies(load) {
                            var depMap = load.depMap;
                            var loadDependencies = Object.keys(depMap).map(function(dependencyName) {
                                return depMap[dependencyName];
                            }).filter(function(normalizedDependencyName) {
                                // in case some module are not in System.loads
                                // may happen for jsenv for instance (because System.trace is not true?)
                                return normalizedDependencyName in loads;
                            }).map(function(normalizedDependencyName) {
                                return loads[normalizedDependencyName];
                            }).filter(function() {
                                // console.log('is', load.name, 'in', moduleURI.href);
                                return moduleURI.includes(load.address);
                            });

                            graph.register(load, loadDependencies);
                            loadDependencies.forEach(function(loadDependency) {
                                recursivelyRegisterDependencies(loadDependency);
                            });
                        }

                        recursivelyRegisterDependencies(moduleLoad);

                        graph.sort().forEach(function(load) {
                            var testExports = getTestExports(load);

                            if (testExports) {
                                var properties = Object.assign({
                                    name: load.address,
                                    uri: jsenv.createURI(load.address)
                                }, testExports);

                                this.add(properties);
                            }
                        }, this);

                        if (this.runActions.length === 0) {
                            this.skip('no test exported');
                        }
                    }
                });
            });
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
