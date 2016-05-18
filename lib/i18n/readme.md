# i18n

JavaScript i18n

## Example

```javascript
import I18N from 'jsenv/i18n';

let i18n = I18N.create({
	"greetings": {
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

## Description

This module allow to conditionnaly generate string depending global and local options.
Internationalization is just a use case.

## Transformers

```javascript

i18n.registerTransformer('')

});
```

## Traits
