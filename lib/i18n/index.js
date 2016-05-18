import ApplicationDictionnary from './lib/index.js';

import LanguageTrait from './lib/trait-language.js';
import languages from './languages.json';

let I18N = ApplicationDictionnary.Lexicon.branch();

I18N.options.preferences = ['en'];
// lang:en, lang:fr, lang:en-us
I18N.options.traits.lang = LanguageTrait;

// shortcut to be able to write "en" instead of "lang:en"
// still missing to be able to write "en-us" instead of "lang:en-us" (languages.json should contain locales)
languages.forEach(function(language) {
    I18N.options.traits[language.code] = LanguageTrait.equals(language.code);
    if (language.locales) {
        language.locales.forEach(function(locale) {
            let localeCode = language.code + '-' + locale;

            I18N.options.traits[localeCode] = LanguageTrait.equals(localeCode);
        });
    }
});

I18N.registerTransformer('get', function(input, propertyName) {
    return input[propertyName];
});
I18N.registerTransformer('call', function(input, ...args) {
    return input(...args);
});
I18N.registerTransformer('length', 'get:length');
I18N.registerTransformer('name', 'get:name');
I18N.registerTransformer('id', 'get:id');

export default I18N;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("core", function() {
            let i18n = I18N.create();

            let term = i18n.register("greetings");

            let enVariant = term.register("Hello");
            enVariant.populate('lang:en');

            let frVariant = term.register("Bonjour");
            frVariant.populate('lang:fr');

            let enTermBranch = term.branch({
                preferences: ['en']
            });

            let frTermBranch = term.branch({
                preferences: ['fr']
            });

            assert.equal(enTermBranch.render(), 'Hello');
            assert.equal(frTermBranch.render(), 'Bonjour');
        });

        this.add("variant.populate()", function() {
            let variant = I18N.Variant.create('ok');
            console.log(Object.prototype.isPrototypeOf.call(I18N.options, I18N.Variant.options));
            console.log('lang' in variant.options.traits);

            variant.populate("lang:fr+lang:en");

            assert.equal(variant.children[0].params[0], 'fr');
            assert.equal(variant.children[1].params[0], 'en');
        });

        this.add("translation.populate()", function() {
            let translation = I18N.Term.create("greetings");
            translation.populate({
                "lang:fr": "Bonjour",
                "lang:en": "Hello",
                // this notation is equivalent to
                // "de": "Hallo",
                // "de+test": "Hallo test"
                "lang:de": {
                    "": "Hallo",
                    "lang:en": "Hallo test"
                }
            });

            assert.equal(translation.children[0].template.source, 'Bonjour');
            assert.equal(translation.children[1].template.source, 'Hello');
            assert.equal(translation.children[2].template.source, 'Hallo');
            assert.equal(translation.children[3].template.source, 'Hallo test');
        });
    }
};
