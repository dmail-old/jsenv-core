/* eslint-disable no-path-concat */

/*

https://github.com/zloirock/core-js#custom-build-from-external-scripts

- babel en utilisant babel 6 et les plugins

- une fois que ça marcheras faudra reporter ce comportement sur le browser qui demandera au serveur
un build de polyfill et communiquera aussi les bables plugins dont il a besoin
(peut-on profiter du cache vu la nature dynamique? je pense que oui suffit de renvoyer que le fichier n'a pas changé
lorsqu'on demande if-modified-since)

- à un moment il faudrais mettre en cache les builds de polyfill pour éviter de les reconstruire tout le temps
mais on retarde ça le plus possible parce que ça a des impacts (comment invalider ce cache etc) et c'est dispensable

*/

var fs = require('fs');
require('./index.js');
var jsenv = global.jsenv;

// exclude some features
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
// handle thoose features using known file path
var featuresHandledByFile = {
    url: __dirname + '/src/polyfill/url/index.js',
    'url-search-params': __dirname + '/src/polyfill/url-search-params/index.js'
};
// other features are handled is a less abvious way by corejs (see coreJSHandler below)

function coreJSHandler(requiredFeatures) {
    var handled = [];
    var unhandled = [];
    requiredFeatures.forEach(function(feature) {
        if (feature.name in featuresHandledByFile) {
            unhandled.push(feature);
        } else {
            handled.push(feature);
        }
    });

    return {
        unhandled: unhandled,
        compile: function() {
            var buildCoreJS = require('core-js-builder');

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

            handled.forEach(function(nativeFeature) {
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

            var requiredCoreJSModules = handled.map(function(nativeFeature) {
                return nativeFeatureForcedCoreJSMapping[nativeFeature.name];
            }).filter(function(value, index, list) {
                return list.indexOf(value) === index;
            });

            return buildCoreJS({
                modules: requiredCoreJSModules,
                librabry: false,
                umd: true
            });
        }
    };
}

function fileHandler(requiredFeatures) {
    var unhandled = [];
    var handled = [];
    requiredFeatures.forEach(function(feature) {
        if (feature.name in featuresHandledByFile) {
            handled.push(feature);
        } else {
            unhandled.push(feature);
        }
    });

    return {
        unhandled: unhandled,
        compile: function() {
            var fileContentPromises = handled.map(function(feature) {
                return featuresHandledByFile[feature.name];
            }).map(function(filePath) {
                return new Promise(function(resolve, reject) {
                    fs.readFile(filePath, function(error, buffer) {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(buffer.toString());
                        }
                    });
                });
            });

            return Promise.all(fileContentPromises).then(function(sources) {
                return sources.join('\n\n');
            });
        }
    };
}

function compile(features) {
    var unhandledFeatures = features;
    var compilers = [];

    [
        coreJSHandler,
        fileHandler
    ].forEach(function(handler) {
        var result = handler(unhandledFeatures);
        unhandledFeatures = result.unhandled;
        compilers.push(result.compile);
    });

    if (unhandledFeatures.length) {
        var unhandledFeatureNames = unhandledFeatures.map(function(unhandledFeature) {
            return unhandledFeature.name;
        });
        throw new Error('unhandled features: ' + unhandledFeatureNames);
    }

    var compilePromises = compilers.map(function(compile) {
        return compile();
    });

    return Promise.all(compilePromises).then(function(sources) {
        return sources.join('\n\n');
    });
}

var requiredFeatures = jsenv.implementation.getRequiredFeatures();
var requiredNativeFeatures = requiredFeatures.filter(function(feature) {
    return feature.type === 'native';
});

compile(requiredNativeFeatures).then(function(source) {
    fs.writeFileSync('polyfill-all.js', source);
    eval(source); // eslint-disable-line

    var failedFeaturesPolyfill = requiredNativeFeatures.filter(function(nativeFeature) {
        return nativeFeature.test() === false;
    }).map(function(nativeFeature) {
        return nativeFeature.name;
    });
    if (failedFeaturesPolyfill.length) {
        console.log('following features failed polyfill', failedFeaturesPolyfill);
    }
});

// console.log('required core js modules', requiredCoreJSModules);

// global.jsenv.generate().then(function(env) {
//     var mainModuleURL = env.locate('./server.js');
//     return env.importMain(mainModuleURL);
// });
