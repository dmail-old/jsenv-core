import I18N from './lib/i18n.js';

import languages from './languages.json';

let customI18N = I18N.branch();

// shortcut to be able to write "en" instead of "lang:en"
// still missing to be able to write "en-us" instead of "lang:en-us" (languages.json should contain locales)
languages.forEach(function(language) {
    customI18N.options.traits[language.code] = customI18N.LanguageTrait.equals(language.code);
    if (language.locales) {
        language.locales.forEach(function(locale) {
            let localeCode = language.code + '-' + locale;

            customI18N.options.traits[localeCode] = customI18N.LanguageTrait.equals(localeCode);
        });
    }
});

customI18N.registerTransformer(function get(input, propertyName) {
    return input[propertyName];
});
customI18N.registerTransformer(function call(input, ...args) {
    return input(...args);
});
customI18N.registerTransformer('length', 'get:length');
customI18N.registerTransformer('name', 'get:name');
customI18N.registerTransformer('id', 'get:id');

export default customI18N;
