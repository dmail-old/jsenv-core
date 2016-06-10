import env from 'env';
import Options from 'env/options';
import proto from 'env/proto';

import Reporter from './lib/reporter.js';
import Test from './lib/test.js';

let System = env.System;
let testPlugin = {
    defaultOptions: {
        location: null,
        recursive: false,
        reporter: null,
        reportConsole: true,
        reportJSON: false
    },

    install(options) {
        System.trace = true;
        // env.System.execute = true;
    },

    report() {
        var options = this.options;
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
            function getTestDefinition(load) {
                let definitionPromise;
                let exports = load.metadata.entry.module.exports;

                if (exports && 'test' in exports) {
                    let testDefinition = exports.test;

                    if (typeof testDefinition === 'string') {
                        definitionPromise = env.importDefault(testDefinition, moduleLoad.address);
                    } else {
                        definitionPromise = Promise.resolve(testDefinition);
                    }
                } else {
                    definitionPromise = Promise.resolve(null);
                }

                return definitionPromise;
            }

            return Promise.resolve().then(function() {
                // si on est en mode recursif on doit commencer par tester le moulde le moins dépendants
                // puis tester les modules parents etc
                if (options.recursive === false) {
                    return getTestDefinition(moduleLoad).then(function(definition) {
                        var properties = {
                            uri: env.createURI(options.location),
                            name: options.location,
                            options: Options.create(Test.options, options)
                        };
                        if (definition) {
                            Object.assign(properties, definition);
                        } else {
                            properties.skipReason = 'no test exported';
                        }

                        return Test.create(properties);
                    });
                }

                // au lieu de parcourir recursivement on va recursivement créer des tests pour chaque fichier
                // parce que là on assume qu'on fait récursivemen tout alors qu'il ne faudrais faire récusrivement que si le fichier
                // n'exporte pas de test, ou on pourrait apeller ça recursive = 'auto'

                return env.importDefault('jsenv/dependency-graph').then(function(DependencyGraph) {
                    return Test.create({
                        uri: env.createURI(options.location),
                        options: Options.create(Test.options, options),
                        name: options.location,
                        main() {
                            var moduleURI = env.createURI(moduleLoad.address);
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

                            return Promise.all(graph.sort().map(function(load) {
                                return getTestDefinition(load).then(function(definition) {
                                    if (definition) {
                                        var properties = Object.assign({
                                            name: load.address,
                                            uri: env.createURI(load.address)
                                        }, definition);

                                        this.add(properties);
                                    }
                                }.bind(this));
                            })).then(function() {
                                if (this.runActions.length === 0) {
                                    this.skip('no test exported');
                                }
                            }.bind(this));
                        }
                    });
                });
            });
        }).then(function(test) {
            return test.exec();
        });
    }
});

export default TestPlugin;
