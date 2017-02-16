expose({
    /*
    regenerator : ${rootFolder}/node_modules/regenerator/dist/regenerator.js
    transform-async-to-generator : http://babeljs.io/docs/plugins/transform-async-to-generator/

    cette solution a besoin d'avoir un objet dispo dans lenvironnement global
    donc d'inclure regenerator qui vient de facebook

    https://github.com/facebook/regenerator/tree/master/packages/regenerator-transform

    de plus si on utilise la syntaxe async, on a besoin de transform-async-to-generator
    donc il faudrais mettre dans function/async que la solution c'est
    'transform-async-to-generator' et que utiliser async force l'utilisation de la solution ci-dessous
    c'est une exception mais faudra réfléchir comment l'exprimer
    car il n'est actuellement pas possible d'exprimer des dépendances entre solutions (seulement entres features)
    */
    solution: {
        type: 'babel',
        value: 'transform-regenerator',
        config: function(features) {
            var config = {};
            config.generators = jsenv.Iterable.some(features, function(feature) {
                return feature.match('function/generator');
            });
            config.async = jsenv.Iterable.some(features, function(feature) {
                return feature.match('function/async');
            });
            config.asyncGenerators = jsenv.Iterable.some(features, function(feature) {
                return feature.match('function/generator/async');
            });
            return config;
        }
    }
});
