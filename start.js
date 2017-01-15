/*

https://github.com/zloirock/core-js#custom-build-from-external-scripts

-

- il faut ajouter au polyfill dynamique url, url-search-params
voir si corejs promise fait le taff si oui pas besoin de l'ajouter
donc on concat juste ces polyfill au code de corejs et ça devrait le faire
pour systemjs on le garde à part pour le moment et on le load toujours avec require ou un <script>

- une fois qu'on aura ça ça serais bien d'avoir une erreur si
on a besoin d'une feature mais que son test() retourne false
sans qu'un polyfill ne lui soit associé

- une fois que ça marcheras faudra reporter ce comporte sur le browser qui demandera au serveur
un build de polyfill
(peut-on profiter du cache vu la nature dynamique? je pense que oui suffit de renvoyer que le fichier n'a pas changé
lorsqu'on demande if-modified-since)

- ensuite on refais la même avec babel en utilisant babel 6 et les plugins

- à un moment il faudrais mettre en cache les builds de polyfill pour éviter de les reconstruire tout le temps
mais on retarde ça le plus possible parce que ça a des impacts (comment invalider ce cache etc) et c'est dispensable

*/

require('./index.js');

var jsenv = global.jsenv;

[
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
].forEach(function(excludedFeature) {
    jsenv.implementation.exclude(excludedFeature, 'npm corejs@2.4.1 does not have thoose polyfill');
});

var requiredFeatures = jsenv.implementation.getRequiredFeatures();
var requiredNativeFeatures = requiredFeatures.filter(function(feature) {
    return feature.type === 'native';
});
var nativeFeatureNamesNotHandledByCoreJS = [];
var requiredNativeFeaturesHandledByCoreJS = requiredNativeFeatures.filter(function(nativeFeature) {
    return nativeFeatureNamesNotHandledByCoreJS.indexOf(nativeFeature.name) === -1;
});
var nativeFeatureForcedCoreJSMapping = {
    'set-immediate': 'web.immediate',

    'array-buffer': 'es6.typed.array-buffer',
    'data-view': 'es6.typed.data-view',
    'int8-array': 'es6.typed.int8-array',
    'uint8-array': 'es6.typed.uint8-array',
    'uint8-clamped-array': 'es6.typed.uint8-clamped-array',
    'int16-array': 'es6.typed.int16-array',
    'uint16-array': 'es6.typed.uint16-array',
    'int32-array': 'es6.typed.int32-array',
    'uint32-array': 'es6.typed.uint32-array',
    'float32-array': 'es6.typed.float32-array',
    'float64-array': 'es6.typed.float64-array',

    'node-list-iteration': 'web.dom.iterable',
    'dom-token-list-iteration': 'web.dom.iterable',
    'media-list-iteration': 'web.dom.iterable',
    'style-sheet-list-iteration': 'web.dom.iterable',
    'css-rule-list-iteration': 'web.dom.iterable',

    'number-iterator': 'core.number.iterator',
    'regexp-escape': 'core.regexp.escape',
    'string-escape-html': 'core.string.escape-html',
    'string-trim-end': 'es7.string.trim-right',
    'string-trim-start': 'es7.string.trim-left',
    'string-unescape-html': 'core.string.unescape-html',
    'symbol-has-instance': 'es6.symbol',
    'symbol-match': 'es6.symbol',
    'symbol-replace': 'es6.symbol',
    'symbol-search': 'es6.symbol',
    'symbol-split': 'es6.symbol',
    'symbol-to-primitive': 'es6.symbol'
};
requiredNativeFeaturesHandledByCoreJS.forEach(function(nativeFeature) {
    var featureName = nativeFeature.name;
    if (featureName in nativeFeatureForcedCoreJSMapping === false) {
        nativeFeatureForcedCoreJSMapping[featureName] = getCoreJSModuleNameOfNativeFeature(nativeFeature);
    }
});
function getCoreJSModuleNameOfNativeFeature(nativeFeature) {
    var coreJsModuleName;
    var featureSpec = nativeFeature.spec;

    coreJsModuleName = featureSpec;

    var featureName = nativeFeature.name;
    var dashIndex = featureName.indexOf('-');
    var beforeFirstDash = dashIndex === -1 ? featureName : featureName.slice(0, dashIndex);

    if (
        beforeFirstDash === 'array' ||
        beforeFirstDash === 'date' ||
        beforeFirstDash === 'function' ||
        beforeFirstDash === 'object' ||
        beforeFirstDash === 'symbol' ||
        beforeFirstDash === 'math' ||
        beforeFirstDash === 'number' ||
        beforeFirstDash === 'reflect' ||
        beforeFirstDash === 'regexp' ||
        beforeFirstDash === 'string'
    ) {
        coreJsModuleName += '.' + beforeFirstDash;

        var afterFirstDash = dashIndex === -1 ? '' : featureName.slice(dashIndex + 1);
        if (afterFirstDash) {
            coreJsModuleName += '.' + afterFirstDash;
        }
    } else {
        coreJsModuleName += '.' + featureName;
    }

    return coreJsModuleName;
}

var requiredCoreJSModules = requiredNativeFeaturesHandledByCoreJS.map(function(nativeFeature) {
    return nativeFeatureForcedCoreJSMapping[nativeFeature.name];
}).filter(function(value, index, list) {
    return list.indexOf(value) === index;
});

var fs = require('fs');
var buildCoreJS = require('core-js-builder');

// console.log('required core js modules', requiredCoreJSModules);

buildCoreJS({
    modules: requiredCoreJSModules,
    librabry: false,
    umd: true
}).then(function(code) {
    fs.writeFileSync('polyfill-all.js', code);

    eval(code); // eslint-disable-line

    var failedCoreJSPolyfill = requiredNativeFeaturesHandledByCoreJS.filter(function(nativeFeature) {
        return nativeFeature.test() === false;
    }).map(function(nativeFeature) {
        return nativeFeature.name;
    });
    if (failedCoreJSPolyfill.length) {
        console.log('corejs did not fullfill following features', failedCoreJSPolyfill);
    }
});

// global.jsenv.generate().then(function(env) {
//     var mainModuleURL = env.locate('./server.js');
//     return env.importMain(mainModuleURL);
// });
