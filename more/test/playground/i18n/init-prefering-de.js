require('../../index.js');

var engine = global.engine;

engine.config(function() {
    engine.language.listPreferences = function() {
        return 'de,en';
    };

    /*
    OK JE L'AI
    en fait i18n va détecter qu'il a été appelé et qu'il a besoin, ou pas de charger des fichier pour être prêt
    et on va toujours appelé dans tout les System.import qu'on retourne le module que lorsque I18N.ready() est résolu
    I18N.ready retourne une promesse qui est résolu lorsque les i18n actuellement en cours de chargement sont résolu

    un problème: c'est pas compatible avec le system de build mais à la limite c'est normal puisque c'est runtime en fait

    si d'autre i18n module sont créé pendant qu'une promesse i18n ready a été retourné peu importe c'est dissocié
    en d'autre terme le fait de faire I18N.ready() doit trouver tout les modules en cours de chargements et faire une
    promesse lorsqu'ils sont tous chargé
    */

    return System.import('../../node_modules/@dmail/i18n/index.js').then(function(exports) {
        return exports.default;
    }).then(function(I18N) {
        global.i18n = I18N;
        engine.registerCoreModule('i18n', I18N);

        var oldImport = System.import;
        System.import = function() {
            return oldImport.apply(this, arguments).then(function(exports) {
                return I18N.ready().then(function() {
                    return exports;
                });
            });
        };
    });
});

engine.run(function() {
    // the module with i18n support should declare a list of available languages and not be ready until the list is fully resolved
    System.import('./module-with-i18n.js').then(function() {
        console.log('current i18n', global.i18n);
    });
});
