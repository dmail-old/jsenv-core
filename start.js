/* eslint-disable no-path-concat */

/*

- démarrer un serveur de dev qui sera charger de fournir le polyfill et de transpiler
le js d'un client qui s'y connecte

pour faire ça faut pouvoir charger les modules en utilisant SystemJS
pour le moment je vois aucune raison de ne pas s'en servir directement
sans se prendre la tête plus que ça

- une fois que ça marcheras faudra reporter ce comportement sur le browser qui demandera au serveur
un build de polyfill et communiquera aussi les bables plugins dont il a besoin

- à un moment il faudrais mettre en cache les builds de polyfill pour éviter de les reconstruire tout le temps
mais on retarde ça le plus possible parce que ça a des impacts (comment invalider ce cache etc) et c'est dispensable

- more : npm install dynamique

*/

require('./index.js');
var jsenv = global.jsenv;
var implementation = jsenv.implementation;
var Iterable = jsenv.Iterable;

var excludedFeatures = [
    'math-clamp',
    'math-deg-per-rad',
    'math-degrees',
    'math-fscale',
    'math-radians',
    'math-rad-per-deg',
    'math-scale',
    'string-escape-html',
    'string-match-all',
    'string-unescape-html'
];
excludedFeatures.forEach(function() {
    // implementation.exclude(excludedFeature, 'npm corejs@2.4.1 does not have thoose polyfill');
});

var babelSolver = {
    name: 'babel',
    solutions: [
        {
            name: 'transform-es2015-block-scoping',
            features: [
                // provide thoose const features
                'const',
                'const-scoped-block',
                'const-not-in-statement',
                'const-throw-on-redefine',
                'const-scope-for-in',
                'const-scoped-for-of',
                'const-temporal-dead-zone',
                // provide thoose let features
                'let'
            ]
        },
        {
            name: 'transform-es2015-computed-properties',
            features: [
                'computed-properties'
            ]
        },
        {
            name: 'transform-es2015-for-of',
            features: [
                'for-of'
            ]
        }
    ],
    solve: function() {
        this.solutions.unshift({
            name: 'transform-es2015-modules-systemjs',
            features: []
        });
        this.solutions.unshift({
            name: 'check-es2015-constants',
            features: []
        });

        var transpile = function(code) {
            return code;
        };
        if (this.solutions.length === 0) {

        } else {
            var requiredPlugins = [];
            Iterable.forEach(this.solutions, function(solution) {
                if (Iterable.includes(requiredPlugins, solution.name) === false) {
                    requiredPlugins.push(solution.name);
                }
            });
            console.log('required babel plugins', requiredPlugins);

            var babel = require('babel-core');
            transpile = function(code, filename) {
                return babel.transform(code, {
                    filename: filename,
                    sourceMap: 'inline',
                    plugins: requiredPlugins
                }).code;
            };
        }

        this.transpile = transpile;
    },
    afterAllSolveHook: function() {
        var transpile = this.transpile;
        jsenv.global.System.translate = function(load) {
            load.metadata.format = 'register';
            var code = load.source;
            var filename = load.address;
            const result = transpile(code, filename);
            return result;
        };
    },
    beforeSolvingFeatureHook: function(feature, solution) {
        feature.status = 'unspecified';
        feature.statusReason = 'transpiling';
        feature.statusDetail = 'babel:' + solution.name;
    },
    afterSolvingFeatureHook: function(feature, solution) {
        feature.statusIsFrozen = true;
        feature.status = 'valid';
        feature.statusReason = 'transpiled';
        feature.statusDetail = 'babel:' + solution.name;
    }
};
var coreJSSolver = {
    name: 'corejs',
    solutions: [
        {
            name: 'es6.promise',
            features: [
                'promise',
                'promise-unhandled-rejection',
                'promise-rejection-handled'
            ]
        },
        {
            name: 'es6.symbol',
            features: [
                'symbol',
                'symbol-to-primitive'
            ]
        },
        {
            name: 'es6.object.get-own-property-descriptor',
            features: [
                'object-get-own-property-descriptor'
            ]
        },
        {
            name: 'es6.date.now',
            features: [
                'date-now'
            ]
        },
        {
            name: 'es6.date.to-iso-string',
            features: [
                'date-prototype-to-iso-string',
                'date-prototype-to-iso-string-negative-5e13',
                'date-prototype-to-iso-string-nan-throw'
            ]
        },
        {
            name: 'es6.date.to-json',
            features: [
                'date-prototype-to-json',
                'date-prototype-to-json-nan-return-null',
                'date-prototype-to-json-use-iso-string'
            ]
        },
        {
            name: 'es6.date.to-primitive',
            features: [
                'date-prototype-symbol-to-primitive'
            ]
        },
        {
            name: 'es6.date-to-string',
            features: [
                'date-prototype-to-string-nan-return-invalid-date'
            ]
        }
    ],
    solve: function() {
        var self = this;

        return new Promise(function(resolve) {
            var buildCoreJS = require('core-js-builder');
            var requiredCodeJSModules = Iterable.map(self.solutions, function(solution) {
                return solution.name;
            });
            console.log('required corejs modules', requiredCodeJSModules);
            var promise = buildCoreJS({
                modules: requiredCodeJSModules,
                librabry: false,
                umd: true
            });
            resolve(promise);
        }).then(function(code) {
            var fs = require('fs');
            fs.writeFileSync('polyfill-all.js', code);
            eval(code); // eslint-disable-line
        });
    },
    beforeSolvingFeatureHook: function(feature, solution) {
        feature.status = 'unspecified';
        feature.statusReason = 'polyfilling';
        feature.statusDetail = 'corejs:' + solution.name;
    },
    afterSolvingFeatureHook: function(feature, solution) {
        feature.status = 'unspecified';
        feature.statusReason = 'polyfilled';
        feature.statusDetail = 'corejs:' + solution.name;
    }
};
var fileSystemSolver = {
    name: 'filesystem',
    solutions: [
        {
            name: __dirname + '/node_modules/systemjs/dist/system.src.js',
            features: [
                'system'
            ]
        },
        {
            name: __dirname + '/src/polyfill/url/index.js',
            features: [
                'url'
            ]
        },
        {
            name: __dirname + '/src/polyfill/url-search-params/index.js',
            features: [
                'url-search-params'
            ]
        }
    ],
    solve: function() {
        var fs = require('fs');
        var sourcesPromises = Iterable.map(this.solutions, function(solution) {
            return new Promise(function(resolve, reject) {
                fs.readFile(solution.name, function(error, buffer) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(buffer.toString());
                    }
                });
            });
        });
        return Promise.all(sourcesPromises).then(function(sources) {
            return sources.join('\n\n');
        }).then(function(code) {
            if (code) {
                var fs = require('fs');
                fs.writeFileSync('fs-all.js', code);
                eval(code); // eslint-disable-line
            }
        });
    },
    beforeSolvingFeatureHook: function(feature, solution) {
        feature.status = 'unspecified';
        feature.statusReason = 'polyfilling';
        feature.statusDetail = 'filesystem:' + solution.name;
    },
    afterSolvingFeatureHook: function(feature, solution) {
        feature.status = 'unspecified';
        feature.statusReason = 'polyfilled';
        feature.statusDetail = 'filesystem:' + solution.name;
    }
};
var solvers = [babelSolver, coreJSSolver, fileSystemSolver];

implementation.scan(function(report) {
    var problematicFeatures = report.includedAndInvalid.slice();

    solvers = Iterable.map(solvers, function(solver) {
        var getRequiredFeatures = function(features) {
            var requiredFeatures = [];

            Iterable.forEach(features, function(featureName) {
                var problematicFeatureIndex = Iterable.findIndex(problematicFeatures, function(problematicFeature) {
                    return problematicFeature.name === featureName;
                });
                if (problematicFeatureIndex > -1) {
                    requiredFeatures.push(problematicFeatures[problematicFeatureIndex]);
                    problematicFeatures.splice(problematicFeatureIndex, 1);
                }
            });

            return requiredFeatures;
        };
        var getRequiredSolutions = function(solutions) {
            var requiredSolutions = [];

            Iterable.forEach(solutions, function(solution) {
                var requiredFeatures = getRequiredFeatures(solution.features, solution);
                if (requiredFeatures.length) {
                    var requiredSolution = jsenv.assign({}, solution);

                    requiredSolution.features = requiredFeatures;
                    requiredSolutions.push(requiredSolution);
                }
            });

            return requiredSolutions;
        };

        var requiredSolutions = getRequiredSolutions(solver.solutions);
        solver = jsenv.assign({}, solver);
        solver.solutions = requiredSolutions;
        return solver;
    });

    if (problematicFeatures.length) {
        throw new Error('no solution for: ' + problematicFeatures.join(','));
    }

    function forEachSolverFeature(solver, fn) {
        Iterable.forEach(solver.solutions, function(solution) {
            Iterable.forEach(solution.features, function(feature) {
                fn(feature, solution, solver);
            });
        });
    }

    var solversPromises = Iterable.map(solvers, function(solver) {
        forEachSolverFeature(solver, function(feature, solution) {
            solver.beforeSolvingFeatureHook(feature, solution);
        });
        return solver.solve();
    });
    Promise.all(solversPromises).then(function() {
        Iterable.forEach(solvers, function(solver) {
            forEachSolverFeature(solver, function(feature, solution) {
                solver.afterSolvingFeatureHook(feature, solution);
            });
        });

        var findFeatureSolutionInSolver = function(solver, feature) {
            var matchingSolution;
            var solutions = solver.solutions;
            var i = solutions.length;
            while (i--) {
                var solution = solutions[i];
                var solutionFeatures = solution.features;
                var m = solutionFeatures.length;
                while (m--) {
                    var solutionFeature = solutionFeatures[m];
                    if (solutionFeature.match(feature)) {
                        matchingSolution = solution;
                        break;
                    }
                }
                if (matchingSolution) {
                    break;
                }
            }

            return matchingSolution;
        };

        var findFeatureSolution = function(solvers, feature) {
            var i = solvers.length;
            var featureSolution;
            while (i--) {
                featureSolution = findFeatureSolutionInSolver(solvers[i], feature);
                if (featureSolution) {
                    break;
                }
            }
            return featureSolution;
        };

        return new Promise(function(resolve, reject) {
            implementation.scan(function(secondReport) {
                var stilProblematicFeatures = secondReport.includedAndInvalid;
                if (stilProblematicFeatures.length) {
                    stilProblematicFeatures.forEach(function(feature) {
                        var featureSolution = findFeatureSolution(solvers, feature);
                        console.log(feature.name, 'not fixed by', featureSolution.name);
                    });
                    reject();
                } else {
                    console.log(report.includedAndInvalid.length, 'feature have been fixed');
                    resolve();
                }
            });
        }).catch(function() {
            // que fait-on lorsque il manque des features?
        });
    }).then(function() {
        Iterable.forEach(solvers, function(solver) {
            if ('afterAllSolveHook' in solver) {
                solver.afterAllSolveHook();
            }
        });
        // console.log('SystemJS got a custom translate ?', System.translate);
        return System.import('./answer.js').then(function(exports) {
            console.log('exported default', exports.default);
        });
    }).catch(function(e) {
        // because unhandled rejection may not be available so error gets ignored
        setTimeout(function() {
            throw e;
        });
    });
});
