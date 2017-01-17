/* eslint-disable no-path-concat */

/*

- more : npm install dynamique

https://github.com/zloirock/core-js#custom-build-from-external-scripts

- chaque polyfill/transpile doit préciser quel cas il couvre
c'est pourquoi le client devras renvoyer non seulement la liste des fatures qui lui manque
mais aussi le statusReason parmi 'missing', 'failed', et 'errored' pour le moment

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
var solutionGroups = [
    {
        name: 'babel',
        descriptors: [
            {
                name: 'transform-es2015-block-scoping',
                features: [
                    // provide thoose const features
                    {name: 'const'},
                    {name: 'const-block-scoped'},
                    {name: 'const-block-scoped'},
                    {name: 'const-not-in-statement'},
                    {name: 'const-throw-on-redefine'},
                    {name: 'const-scope-for'},
                    {name: 'const-scope-for-in'},
                    {name: 'const-scope-for-of'},
                    {name: 'const-temporal-dead-zone'},
                    // provide thoose let features
                    {name: 'let'}
                ]
            }
        ]
    },
    {
        name: 'corejs',
        descriptors: [
            {
                name: 'es6.promise',
                features: [
                    {name: 'promise'},
                    {name: 'promise-unhandled-rejection'},
                    {name: 'promise-rejection-handled'}
                ]
            },
            {
                name: 'es6.symbol',
                features: [
                    {name: 'symbol'},
                    {name: 'symbol-to-primitive'}
                ]
            },
            {
                name: 'es6.object.get-own-property-descriptor',
                features: [
                    {name: 'object.get-own-property-descriptor'}
                ]
            },
            {
                name: 'es6.date.now',
                features: [
                    {name: 'date-now'}
                ]
            },
            {
                name: 'es6.date.to-iso-string',
                features: [
                    {name: 'date-prototype-to-iso-string'}
                ]
            },
            {
                name: 'es6.date.to-json',
                features: [
                    {name: 'date-prototype-to-json'}
                ]
            },
            {
                name: 'es6.date.to-primitive',
                features: [
                    {name: 'date-prototype-symbol-to-primitive'}
                ]
            },
            {
                name: 'es6.date-to-string',
                features: [
                    {name: 'date-prototype-to-string', when: 'failed'} // when: 'failed' because cannot solve 'missing'
                ]
            }
        ]
    },
    {
        name: 'filesystem',
        descriptors: [
            {
                name: __dirname + '/src/polyfill/url/index.js',
                features: [
                    {name: 'url'}
                ]
            },
            {
                name: __dirname + '/src/polyfill/url-search-params/index.js',
                features: [
                    {name: 'url-search-params'}
                ]
            }
        ]
    }
];

excludedFeatures.forEach(function() {
    // implementation.exclude(excludedFeature, 'npm corejs@2.4.1 does not have thoose polyfill');
});
implementation.groupFeatures(function(groups) {
    var problematicFeatures = groups.includedAndInvalid.map(function(feature) {
        return feature.name;
    });
    console.log('problematic features', problematicFeatures);

    var requiredSolutionGroups = Iterable.map(solutionGroups, mapSolutionGroup);
    function mapSolutionGroup(solutionGroup) {
        var requiredSolutionGroup = jsenv.assign({}, solutionGroup);
        var requiredDescriptors = [];

        problematicFeatures = Iterable.filter(problematicFeatures, function(feature) {
            var descriptorSolvingFeature = Iterable.find(solutionGroup.descriptors, function(solutionDescriptor) {
                return Iterable.some(solutionDescriptor.features, function(featureSolutionDescriptor) {
                    return feature === featureSolutionDescriptor.name;
                });
            });
            var solved;
            if (descriptorSolvingFeature) {
                if (Iterable.includes(requiredDescriptors, descriptorSolvingFeature) === false) {
                    requiredDescriptors.push(descriptorSolvingFeature);
                }
                solved = true;
            } else {
                solved = false;
            }

            return solved === false;
        });

        requiredSolutionGroup.descriptors = requiredDescriptors;

        return requiredSolutionGroup;
    }

    if (problematicFeatures.length) {
        throw new Error('unsolved problematic features: ' + problematicFeatures.join(','));
    }

    var requiredBabelSolutions = requiredSolutionGroups[0].descriptors;
    var requiredCoreJSSolution = requiredSolutionGroups[1].descriptors;
    var requiredFileSystemSolution = requiredSolutionGroups[2].descriptors;

    console.log('required babel solutions', requiredBabelSolutions.map(function(descriptor) {
        return descriptor.name;
    }));
    console.log('required corejs solutions', requiredCoreJSSolution.map(function(descriptor) {
        return descriptor.name;
    }));
    console.log('required filesystem solutions', requiredFileSystemSolution.map(function(descriptor) {
        return descriptor.name;
    }));

    // donc maintenant j'ai "juste" à créer du code que j'éxécute pour corejs + filesystem
    // et une fonction de transpilation pour babel

    // corejs solution
    // var buildCoreJS = require('core-js-builder');
    // return buildCoreJS({
    //     modules: requiredCoreJSModules,
    //     librabry: false,
    //     umd: true
    // });
    // filesystem solution (se combine avec core js pour ne produire qu'un fichier)
    // var fileContentPromises = handled.map(function(feature) {
    //     return featuresHandledByFile[feature.name];
    // }).map(function(filePath) {
    //     var fs = require('fs');
    //     return new Promise(function(resolve, reject) {
    //         fs.readFile(filePath, function(error, buffer) {
    //             if (error) {
    //                 reject(error);
    //             } else {
    //                 resolve(buffer.toString());
    //             }
    //         });
    //     });
    // });
    // return Promise.all(fileContentPromises).then(function(sources) {
    //     return sources.join('\n\n');
    // });
    // babel solution
    // produit une fonction de transpilation spécifique
    // qui est installé sur SystemJS
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

// var requiredStandardFeatures = requiredFeatures.filter(function(feature) {
//     return feature.type === 'standard';
// });
// compile(requiredStandardFeatures).then(function(source) {
//     fs.writeFileSync('polyfill-all.js', source);
//     eval(source); // eslint-disable-line

//     var failedFeaturesPolyfill = requiredStandardFeatures.filter(function(standardFeature) {
//         return standardFeature.test() === false;
//     }).map(function(standardFeature) {
//         return standardFeature.name;
//     });
//     if (failedFeaturesPolyfill.length) {
//         console.log('following features failed polyfill', failedFeaturesPolyfill);
//     }
// });
// var requiredSyntaxFeatures = requiredFeatures.filter(function(feature) {
//     return feature.type === 'syntax';
// });

// function babelHandler(requiredFeatures) {
//     var plugins = [
//
//     ];
//     var requiredPlugins = [];

//     requiredFeatures.forEach(function(requiredFeature) {
//         console.log('feature', requiredFeature.name, 'is required because', requiredFeature.validityReason);

//         var requiredFeatureName = requiredFeature.name;
//         var pluginForThatFeature = jsenv.helpers.find(plugins, function(plugin) {
//             return plugin.features.some(function(pluginFeatureName) {
//                 return pluginFeatureName === requiredFeatureName;
//             });
//         });

//         if (pluginForThatFeature) {
//             var requiredPluginName = pluginForThatFeature.name;
//             if (requiredPlugins.indexOf(requiredPluginName) === -1) {
//                 requiredPlugins.push(requiredPluginName);
//             }
//         }
//     });
//     console.log('the required babel plugins', requiredPlugins);
// }
// function transpile(requiredFeatures) {
//     return babelHandler(requiredFeatures);
// }
// transpile(requiredSyntaxFeatures);

// console.log('required core js modules', requiredCoreJSModules);

// global.jsenv.generate().then(function(env) {
//     var mainModuleURL = env.locate('./server.js');
//     return env.importMain(mainModuleURL);
// });
