/* eslint-disable no-path-concat */

/*

- avant babel il faudrais s'assure de la présence de SystemJS
pour le moment cette feature est impossible à satisfaire autrmeent que par le polyfill
donc le test doit s'assure de la présence du SystemJS de guy bedford
et donc une fois qu'on a ce SystemJS qui est présent (de par le fichier de polyfill concaténé)
enfin plutot de par filesystem qui gère cette feature
on pourras alors faire en sorte que babel mette son transpile hook dessus
ce qui veut donc dire qu'il faudras attendre le eval() qui install systemjs
il faut donc que l'intsallation de babel se fasse après
une sorte de afterAllSolveHook

plus tard lorsque y'aura le browser on installera pas ça sur SystemJS
et on évaluera pas le code généré par corejs
on se contentera de garder ce qui a été produit et de le filer au client
pour qu'il obtienne un environnement adéquat

- babel en utilisant babel 6 et les plugins

translate hook: https://github.com/ModuleLoader/es-module-loader/issues/525#issuecomment-272708053
fetch hook : issue ouverte sur systemjs

y'a un cas spécial auquel il faudras penser : yield etc
il ont besoin à la fois d'un polyfill (regenerator/runtime) et d'une transpilation)
mais il s'agit d'une seule feature
le code tel qu'il est actuellement prévoi l'un ou l'autre
pour faire simple on a cas mettre les deux features et "forcer" l'utilisateur a savoir qu'il faut exclure/inclure les deux
pour en profiter

- une fois que ça marcheras faudra reporter ce comportement sur le browser qui demandera au serveur
un build de polyfill et communiquera aussi les bables plugins dont il a besoin
(peut-on profiter du cache vu la nature dynamique? je pense que oui suffit de renvoyer que le fichier n'a pas changé
lorsqu'on demande if-modified-since)

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

// il manque le fait que le plugin systemjs est toujours requis
// dans le cas où on a besoin de systemjs
// faudrais donc que corejs puisse soliciter la présence d'un plugin?

var babelSolver = {
    name: 'babel',
    solutions: [
        {
            name: 'transform-es2015-block-scoping',
            features: [
                // provide thoose const features
                'const',
                'const-is-block-scoped',
                'const-not-in-statement',
                'const-throw-on-redefine',
                'const-scope-for',
                'const-scope-for-in',
                'const-scope-for-of',
                'const-temporal-dead-zone',
                // provide thoose let features
                'let'
            ]
        }
    ],
    solve: function() {
        this.solutions.unshift({
            name: 'transform-es2015-modules-systemjs'
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
        jsenv.global.Sytem.transpile = function(code, filename) {
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

        implementation.scan(function(report) {
            var stilProblematicFeatures = report.includedAndInvalid;
            if (stilProblematicFeatures.length) {
                stilProblematicFeatures.forEach(function(feature) {
                    var featureSolution = findFeatureSolution(solvers, feature);
                    console.log(feature.name, 'not fixed by', featureSolution.name);
                });
            } else {
                console.log(problematicFeatures.length, 'feature have been fixed');
            }
        });
    });

    // console.log('required babel solutions', requiredBabelSolutions.map(function(descriptor) {
    //     return descriptor.name;
    // }));
    // console.log('required corejs solutions', requiredCoreJSSolutions.map(function(descriptor) {
    //     return descriptor.name;
    // }));
    // console.log('required filesystem solutions', requiredFileSystemSolutions.map(function(descriptor) {
    //     return descriptor.name;
    // }));
});

// function coreJSHandler(requiredFeatures) {
//     return {
//             var standardFeatureForcedCoreJSMapping = {
//                 'set-immediate': 'web.immediate',

//                 'array-buffer': 'es6.typed.array-buffer',
//                 'data-view': 'es6.typed.data-view',
//                 'int8-array': 'es6.typed.int8-array',
//                 'uint8-array': 'es6.typed.uint8-array',
//                 'uint8-clamped-array': 'es6.typed.uint8-clamped-array',
//                 'int16-array': 'es6.typed.int16-array',
//                 'uint16-array': 'es6.typed.uint16-array',
//                 'int32-array': 'es6.typed.int32-array',
//                 'uint32-array': 'es6.typed.uint32-array',
//                 'float32-array': 'es6.typed.float32-array',
//                 'float64-array': 'es6.typed.float64-array',

//                 'node-list-iteration': 'web.dom.iterable',
//                 'dom-token-list-iteration': 'web.dom.iterable',
//                 'media-list-iteration': 'web.dom.iterable',
//                 'style-sheet-list-iteration': 'web.dom.iterable',
//                 'css-rule-list-iteration': 'web.dom.iterable',

//                 'number-iterator': 'core.number.iterator',
//                 'regexp-escape': 'core.regexp.escape',
//                 'string-escape-html': 'core.string.escape-html',
//                 'string-trim-end': 'es7.string.trim-right',
//                 'string-trim-start': 'es7.string.trim-left',
//                 'string-unescape-html': 'core.string.unescape-html',
//                 'symbol-has-instance': 'es6.symbol',
//                 'symbol-match': 'es6.symbol',
//                 'symbol-replace': 'es6.symbol',
//                 'symbol-search': 'es6.symbol',
//                 'symbol-split': 'es6.symbol',
//                 'symbol-to-primitive': 'es6.symbol'
//             };

// console.log('required core js modules', requiredCoreJSModules);

// global.jsenv.generate().then(function(env) {
//     var mainModuleURL = env.locate('./server.js');
//     return env.importMain(mainModuleURL);
// });
