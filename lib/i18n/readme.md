# i18n

i18n for JavaScript module

## Example

```javascript

import I18N from 'dmail/i18n';

let i18n = I18N.create({
	"greetings", {
		"en": "Hello",
		"fr": "Bonjour"
	},
	"greetings-scope": "#{greetings} {name}"
});

i18n.options.preferences = ['en', 'fr'];
i18n.translate("greetings"); // Hello
i18n.translate("greetings-scope", {name: 'damien'}); // Hello damien

i18n.options.preferences = ['fr', 'en'];
i18n.translate("greetings"); // Bonjour

```
