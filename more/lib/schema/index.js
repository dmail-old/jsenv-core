// import jsenv from 'jsenv';
import I18N from 'jsenv/i18n';

import Schema from './lib/schema.js';

import EnTranslations from './i18n/en.js';

let i18n = I18N.module('schema');

i18n.addLanguage('en', EnTranslations);

Schema.i18n = i18n;

export default Schema;
