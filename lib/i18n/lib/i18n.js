import Dictionnary from 'env/dictionnary';

import languages from './languages.json';

let I18N = Dictionnary.branch(); // we cannot just write extend() because we need a fresh options & Term object

const LanguageTrait = I18N.Term.Definition.Trait.extend('LanguageTrait', {
    name: 'lang',

    getCode(language) {
        let code;
        if (language.includes('-')) {
            code = language.slice(0, 2);
        } else {
            code = language;
        }
        return code;
    },

    getPreferenceLevel() {
        let preferences = this.options.preferences;
        let length = preferences.length;
        let expectedLanguage = this.params[0];
        let index = preferences.findIndex(function(preferenceName) {
            return preferenceName === '*' || expectedLanguage === preferenceName;
        });
        let level;

        if (index === -1 || preferences[index] === '*') {
            // if we couldn't match expectedLanguage or we matched '*' check index ignoring locale
            let i = preferences.length;
            while (i--) {
                let preferenceName = preferences[i];
                if (preferenceName !== '*' && this.getCode(preferenceName) === this.getCode(expectedLanguage)) {
                    index = i;
                    break;
                }
            }

            // but make this match less important by decreasing level by 1
            if (index === -1) {
                level = 0;
            } else {
                level = length - index;
            }
        } else if (index === -1) {
            level = 1;
        } else {
            level = length - index + 1;
        }

        return level;
    },

    check(expectedLanguage) {
        let preferences = this.options.preferences;

        return preferences.some(function(preferenceName) {
            if (preferenceName === '*') {
                return true;
            }
            if (preferenceName === expectedLanguage) {
                return true;
            }

            // locale are optional
            let preferenceCode = this.getCode(preferenceName);
            let expectedCode = this.getCode(expectedLanguage);

            if (preferenceCode === expectedCode) {
                return true;
            }

            return false;
        }, this);
    },

    equals(expectedLanguage) {
        return this.extend({
            name: expectedLanguage,
            params: [expectedLanguage]
        });
    }
});

I18N.options.preferences = ['en'];
// lang:en, lang:fr, lang:en-us
I18N.options.traits.lang = LanguageTrait;

// shortcut to be able to write "en" or "en-us" instead of "lang:en"
languages.forEach(function(language) {
    I18N.options.traits[language.code] = LanguageTrait.equals(language.code);
    // console.log('add trait', language.code);
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
        this.add("languague getPreferenceLevel()", function() {
            function assertLanguageLevel(preferences, language, level) {
                let trait = LanguageTrait.equals(language);

                trait.options.preferences = preferences;

                assert.equal(trait.getPreferenceLevel(), level);
            }

            assertLanguageLevel(['en-gb'], 'en-gb', 2);
            assertLanguageLevel(['en-gb'], 'en', 1);

            assertLanguageLevel(['en-us', 'en-gb'], 'en-gb', 2);
            assertLanguageLevel(['en-us', 'en-gb'], 'en', 1);
            assertLanguageLevel(['en-us', 'en-gb'], 'de', 0);

            assertLanguageLevel(['en-ca', '*'], 'en', 2);
            assertLanguageLevel(['en-ca', '*'], 'en-us', 2);
            assertLanguageLevel(['en-ca', '*'], 'de', 1);
        });

        this.add("core", function() {
            let i18n = I18N.create();

            let term = i18n.register("greetings");
            term.register("Hello", "en");
            term.register("Bonjour", "fr");

            let enTermBranch = term.branch();
            enTermBranch.options.preferences = ['en'];
            let frTermBranch = term.branch();
            frTermBranch.options.preferences = ['fr'];

            assert.equal(enTermBranch.render(), 'Hello');
            assert.equal(frTermBranch.render(), 'Bonjour');
        });

        this.add("term.populate()", function() {
            let term = I18N.Term.create("greetings");

            term.populate({
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

            assert.equal(term.children[0].template.source, 'Bonjour');
            assert.equal(term.children[1].template.source, 'Hello');
            assert.equal(term.children[2].template.source, 'Hallo');
            assert.equal(term.children[3].template.source, 'Hallo test');
        });

        this.add("definition.populate()", function() {
            let definition = I18N.Term.Definition.create('ok');

            definition.populate("lang:fr+lang:en");

            assert.equal(definition.children[0].params[0], 'fr');
            assert.equal(definition.children[1].params[0], 'en');
        });
    }
};
