import env from 'env';
import Options from 'env/options';
// import proto from 'env/proto';

import Reporter from './lib/reporter.js';
import Test from './lib/test.js';

let System = env.System;

let testPlugin = {
    name: 'test',
    defaultOptions: {
        uri: 'auto',
        includeDependents: 'auto',
        // Boolean to force inclusion of dependents
        // 'auto': include if filename is index.js and the file has no explicite export test
        // Function : not supported yet, return a boolean indicating if dependents must be tested
        isPartOfTest: 'auto',
        // Function called on each load to determine if they are part of the test
        // 'auto': the load must be a sibliing or descendant of uri
        report: {
            console: true,
            json: false
        }
    },

    install(options) {
        System.trace = true;
        // env.System.execute = true;
        var useConsole = options.report.console;
        var json = options.report.json;

        if (useConsole || json) {
            var reporter = Reporter.create();
            if (useConsole) {
                reporter.use('console-core');
            }
            if (json) {
                reporter.use('console-json');
            }

            options.reporter = reporter;
        }

        if (options.uri === 'auto') {
            options.uri = env.mainURI;
        } else {
            env.run(function() {
                return System.normalize(options.uri).then(function(normalizedModuleName) {
                    options.uri = env.createURI(normalizedModuleName);
                });
            });
        }

        env.run(function() {
            if (options.isPartOfTest === 'auto') {
                options.isPartOfTest = function(load) {
                    return options.uri.includes(load.address);
                };
            }

            var rootLoad = System.loads[options.uri.href];
            var rootLoadTree = testPlugin.collect(rootLoad, options);

            return testPlugin.generate(rootLoadTree, options).then(function(test) {
                return test.exec();
            });
        });
    },

    collect(load, options) {
        // trace api https://github.com/ModuleLoader/es6-module-loader/blob/master/docs/tracing-api.md
        var includeDependents = options.includeDependents;

        if (includeDependents === 'auto') {
            var exports = load.metadata.entry.module.exports;
            var isIndexFile = load.name.endsWith('/index.js'); // improve later with uri.filename === 'index.js'
            var hasTest = 'test' in exports;

            if (isIndexFile && hasTest === false) {
                includeDependents = true;
            } else {
                includeDependents = false;
            }
        }

        includeDependents = true;

        let dependents;
        if (includeDependents) {
            // au lieu de parcourir recursivement on va recursivement créer des tests pour chaque fichier
            // parce que là on assume qu'on fait récursivemen tout alors qu'il ne faudrais faire récusrivement que si le fichier
            // n'exporte pas de test, ou on pourrait apeller ça recursive = 'auto'

            // donc en résumé ce serais on crée un test par dependants

            if (('depMap' in load) === false) {
                throw new Error('load depMap must be set to include its dependencies');
            }
            var depMap = load.depMap;

            dependents = Object.keys(depMap).map(function(dependencyName) {
                return depMap[dependencyName];
            }).filter(function(normalizedDependencyName) {
                // in case some module are not in System.loads
                // may happen for jsenv for instance (because System.trace is not true?)
                return normalizedDependencyName in System.loads;
            }).map(function(normalizedDependencyName) {
                return System.loads[normalizedDependencyName];
            }).filter(function(dependentLoad) {
                return options.isPartOfTest(dependentLoad);
            }).map(function(dependentLoad) {
                return this.collect(dependentLoad, options);
            }, this);
        } else {
            dependents = [];
        }

        return {
            load: load,
            dependents: dependents
        };
    },

    generate(rootLoad, options) {
        function fetchTestDefinition(load) {
            let definitionPromise;
            let exports = load.metadata.entry.module.exports;

            if (exports && 'test' in exports) {
                let testDefinition = exports.test;

                if (typeof testDefinition === 'string') {
                    definitionPromise = env.importDefault(testDefinition, load.address);
                } else {
                    definitionPromise = Promise.resolve(testDefinition);
                }
            } else {
                definitionPromise = Promise.resolve(null);
            }

            return definitionPromise;
        }

        function fetchTestProperties(load) {
            return fetchTestDefinition(load).then(function(definition) {
                var properties = {
                    uri: env.createURI(load.address),
                    name: load.address
                    // options: Options.create(Test.options, options)
                };
                if (definition) {
                    Object.assign(properties, definition);
                } else {
                    properties.skipReason = 'no test exported';
                }

                return properties;
            });
        }

        // the first thing to do is to sort loadTree to test the module with fewer dependents first

        return env.importDefault('env/dependency-graph').then(function(DependencyGraph) {
            let graph = DependencyGraph.create();

            function recursivelyRegisterLoad(node) {
                // console.log('registering', node.load.address);
                graph.register(node.load, node.dependents.map(function(dependentNode) {
                    return dependentNode.load;
                }));
                node.dependents.forEach(recursivelyRegisterLoad);
            }

            recursivelyRegisterLoad(rootLoad);

            return graph.sort();
        }).then(function(loads) {
            // console.log('loads', loads.map(function(load) {
            //     return load.address;
            // }));

            return Test.create({
                uri: options.uri,
                options: Options.create(Test.options, options),
                name: 'Container for ' + options.uri.href,
                main() {
                    var testPropertiesPromises = loads.map(function(load) {
                        return fetchTestProperties(load);
                    });

                    return Promise.all(testPropertiesPromises).then(function(testPropertiesList) {
                        testPropertiesList.forEach(function(testProperties) {
                            this.add(testProperties);
                        }, this);
                    }.bind(this));
                }
            });
        });
    }
};

export default testPlugin;
