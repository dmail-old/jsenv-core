import Dictionnary from './dictionnary/dictionnary.js';

const LanguageTrait = Dictionnary.Term.Definition.Trait.extend('LanguageTrait', {
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

export default LanguageTrait;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("getPreferenceLevel()", function() {
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
    }
};
