/* eslint-disable no-path-concat */

/*

https://github.com/zloirock/core-js#custom-build-from-external-scripts

- babel en utilisant babel 6 et les plugins
j'ai le concept mais une fois que j'ai ma function de transpilation avec les bons plugins
qu'est ce que je fais ?
je pense qu'il faut alors (puisque SystemJS est chargé)
faire System.translate = ma fonction de transpilation

ah et aussi : c'est pas aussi simple que juste avoir une liste de true/false
certain plugin nécéssite la présence d'autres et il "faudrais" l'exprimer pour que si
on exclue une dépendance on dise ouais mais sans ça tu peux pas avoir ça
ou alors avec ça il faut absolument ça

poster une issue sur systemjs a propos de la dépréciation du fetch hook
car cela me permettait d'autoriser http sous node
https://github.com/systemjs/systemjs/blob/0.20/src/fetch.js
pour translate ça semble bon : https://github.com/ModuleLoader/es-module-loader/issues/525#issuecomment-272708053

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

/*
// bon l'idée c'est bel et bien d'avoir une liste de features dont on souhaite se servir
// et un test associé.
// lorsque ce test ne passe pas
// il peut ou non y avoir un moyen d'y remédier (polyfill/transpile)
// etc mais aussi n'y avoir aucun moyen
// c'est pourquoi chaque polyfill/transpile doit préciser quel cas il couvre

- maintenant que feature.getStatus est asynchrone y'a des choses à revoir
getRequiredFeatures et d'autres choses doivent maintenant être asynchrone
à partir du moment où on commence à tester

- au lieu d'avoir les dependances listé directement dans le package.json
ça serais une tuerie d'avoir une liste de package et ce qu'ils sont censé
corrigé de sorte que seulement si on en a besoin on installe core-js babel plugin etc
faudrais bien penser à lancer les tests en parallèle, pas le choix sinon ils vont être bcp trop long
et puis tfaçon c'ets des tests genre est ce que ça marche ou pas mais
on veut la liste de ce qui marche pas et pas s'arrêter au premier qui marche pas
sauf qu'avec les dépendances on peut pas vraiment les faire en parallèlee....
oh misère!
du coup faudrais que ceux étant dépendant attendent ok pourquoi pas

*/

// var fs = require('fs');
require('./index.js');
var jsenv = global.jsenv;

// exclude some features
// [
//     'math-clamp',
//     'math-deg-per-rad',
//     'math-degrees',
//     'math-fscale',
//     'math-radians',
//     'math-rad-per-deg',
//     'math-scale',
//     'string-escape-html',
//     'string-match-all',
//     'string-unescape-html'
// ].forEach(function(excludedFeature) {
//     jsenv.implementation.exclude(excludedFeature, 'npm corejs@2.4.1 does not have thoose polyfill');
// });
// handle thoose features using known file path
// var featuresHandledByFile = {
//     url: __dirname + '/src/polyfill/url/index.js',
//     'url-search-params': __dirname + '/src/polyfill/url-search-params/index.js'
// };
// other features are handled is a less abvious way by corejs (see coreJSHandler below)
// explicit is better than implicit so not ideal but prevent tons of code, keep as it is for now

// function coreJSHandler(requiredFeatures) {
//     var handled = [];
//     var unhandled = [];
//     requiredFeatures.forEach(function(feature) {
//         if (feature.name in featuresHandledByFile) {
//             unhandled.push(feature);
//         } else {
//             handled.push(feature);
//         }
//     });

//     return {
//         unhandled: unhandled,
//         compile: function() {
//             var buildCoreJS = require('core-js-builder');

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

//             handled.forEach(function(standardFeature) {
//                 var featureName = standardFeature.name;
//                 if (featureName in standardFeatureForcedCoreJSMapping === false) {
//                     standardFeatureForcedCoreJSMapping[featureName] = getSupposedCoreJSModuleName(standardFeature);
//                 }
//             });
//             function getSupposedCoreJSModuleName(standardFeature) {
//                 var coreJsModuleName;
//                 var featureSpec = standardFeature.spec;

//                 coreJsModuleName = featureSpec;

//                 var featureName = standardFeature.name;
//                 var dashIndex = featureName.indexOf('-');
//                 var beforeFirstDash = dashIndex === -1 ? featureName : featureName.slice(0, dashIndex);

//                 if (
//                     beforeFirstDash === 'array' ||
//                     beforeFirstDash === 'date' ||
//                     beforeFirstDash === 'function' ||
//                     beforeFirstDash === 'object' ||
//                     beforeFirstDash === 'symbol' ||
//                     beforeFirstDash === 'math' ||
//                     beforeFirstDash === 'number' ||
//                     beforeFirstDash === 'reflect' ||
//                     beforeFirstDash === 'regexp' ||
//                     beforeFirstDash === 'string'
//                 ) {
//                     coreJsModuleName += '.' + beforeFirstDash;

//                     var afterFirstDash = dashIndex === -1 ? '' : featureName.slice(dashIndex + 1);
//                     if (afterFirstDash) {
//                         coreJsModuleName += '.' + afterFirstDash;
//                     }
//                 } else {
//                     coreJsModuleName += '.' + featureName;
//                 }

//                 return coreJsModuleName;
//             }

//             var requiredCoreJSModules = handled.map(function(standardFeature) {
//                 return standardFeatureForcedCoreJSMapping[standardFeature.name];
//             }).filter(function(value, index, list) {
//                 return list.indexOf(value) === index;
//             });

//             return buildCoreJS({
//                 modules: requiredCoreJSModules,
//                 librabry: false,
//                 umd: true
//             });
//         }
//     };
// }

// function fileHandler(requiredFeatures) {
//     var unhandled = [];
//     var handled = [];
//     requiredFeatures.forEach(function(feature) {
//         if (feature.name in featuresHandledByFile) {
//             handled.push(feature);
//         } else {
//             unhandled.push(feature);
//         }
//     });

//     return {
//         unhandled: unhandled,
//         compile: function() {
//             var fileContentPromises = handled.map(function(feature) {
//                 return featuresHandledByFile[feature.name];
//             }).map(function(filePath) {
//                 return new Promise(function(resolve, reject) {
//                     fs.readFile(filePath, function(error, buffer) {
//                         if (error) {
//                             reject(error);
//                         } else {
//                             resolve(buffer.toString());
//                         }
//                     });
//                 });
//             });

//             return Promise.all(fileContentPromises).then(function(sources) {
//                 return sources.join('\n\n');
//             });
//         }
//     };
// }

// function compile(features) {
//     var unhandledFeatures = features;
//     var compilers = [];

//     [
//         coreJSHandler,
//         fileHandler
//     ].forEach(function(handler) {
//         var result = handler(unhandledFeatures);
//         unhandledFeatures = result.unhandled;
//         compilers.push(result.compile);
//     });

//     if (unhandledFeatures.length) {
//         var unhandledFeatureNames = unhandledFeatures.map(function(unhandledFeature) {
//             return unhandledFeature.name;
//         });
//         throw new Error('unhandled features: ' + unhandledFeatureNames);
//     }

//     var compilePromises = compilers.map(function(compile) {
//         return compile();
//     });

//     return Promise.all(compilePromises).then(function(sources) {
//         return sources.join('\n\n');
//     });
// }

jsenv.implementation.getInvalidFeatures(function(invalidFeatures) {
    console.log('invalid features', invalidFeatures);
});

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
//         {
//             name: 'transform-es2015-block-scoping',
//             features: [
//                 'const',
//                 'const-block-scoped',
//                 'const-not-in-statement',
//                 'const-throw-on-redefine',
//                 'const-scope-for',
//                 'const-scope-for-in',
//                 'const-scope-for-of',
//                 'const-temporal-dead-zone',
//                 'let'
//             ]
//         }
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
