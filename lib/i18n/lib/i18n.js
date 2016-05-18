/*

tag & filter are always executed from translationVariant because nothing else can trigger them
so passing as argument the caller is ok but caller is always a translationVariant object

*/

import jsenv from 'jsenv';
import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import SortedArray from 'jsenv/array-sorted';

import Transformer from './string-template/transformer.js';
import StringTemplate from './string-template/index.js';

const I18NTransformer = Transformer.extend('I18NFormatter', {

});

const TranslationTemplate = StringTemplate.extend('TranslationTemplate', {

});

let options = Options.create(TranslationTemplate.options, {
    traits: Options.create(),
    transformers: Options.create(),
    preferences: ['en'],

    createVariantCompare() {
        return SortedArray.createComparer(
            // si y'a des langues, compare le niveau de préférences des langues, le plus haut gagne
            function(variant) {
                return variant.getPreferenceLevel();
            },
            // sinon c'est la variantes ayant le plus de trait qui prévaut
            function(variant) {
                return variant.getLevel();
            }
        ).compare;
    },

    instantiateTransformer(transformerData) {
        let transformerName = transformerData.name;
        let transformer = Options.ensure(this.transformers, transformerName);
        return transformer.create(transformerData.params);
    }
});

const I18NContext = proto.extend('I18NContext', {
    options: options,
    parent: null,
    children: [],

    constructor() {
        this.options = Options.create(this.options);
        this.children = [];
    },

    create(...args) {
        let item = proto.create.apply(this, args);

        if (this.hasOwnProperty('populate')) {
            let constructorLength = this.constructor.length;
            if (args.length > constructorLength) {
                // console.log('call', proto.kindOf(item), 'populate with', args.slice(constructorLength), 'from', args);
                item.populate(...args.slice(constructorLength));
            }
        }

        return item;
    },

    defineChild(...args) {
        if (this.hasOwnProperty('childPrototype')) {
            throw new Error('childPrototype already defined');
        }
        let childPrototype = proto.extend.apply(this, args);

        this.childPrototype = childPrototype;
        childPrototype.options = Options.create(this.options);

        return childPrototype;
    },

    has(childName) {
        return Boolean(this.get(childName));
    },

    get(childName, ensure = false) {
        let foundChild = this.children.find(function(child) {
            return child.name === childName;
        });

        if (ensure && !foundChild) {
            throw new Error('no such child: ' + childName);
        }

        return foundChild;
    },

    add(child) {
        child.options = Options.create(this.options);
        child.parent = this;
        this.children.push(child);
        return child;
    },

    createChild(...args) {
        let child = this.childPrototype.create(...args);

        return child;
    },

    register(...args) {
        // console.log('calling register on', proto.kindOf(this), 'with', arguments);
        return this.add(this.createChild(...args));
    },

    branch(options = {}) {
        let customOptions = Options.create(this.options, options);
        let branch = this.extend({
            options: customOptions
        });

        branch.children = this.children.map(function(child) {
            let branchChild = child.branch(customOptions);
            branchChild.parent = branch;
            return branchChild;
        });

        return branch;
    },

    detachedBranch() {
        // should create a kind of clone of this and options, same for children
        // but we wouldn't have to clone everything or maube we do
        // because I got no use case atm and it may be complicated juste let it as it is
    }
});

const I18N = I18NContext.defineChild('i18n', {
    populate(data) {
        Object.keys(data).forEach(function(key) {
            this.register(key, data[key]);
        }, this);
    },

    translate(translationName, scope = undefined) {
        let translation = this.get(translationName);

        if (!translation) {
            // a warning saying nothing has matched
            jsenv.warn('no translation named', translationName);
            return translationName;
        }

        let translationBranch = translation.branch({
            scope: scope
        });

        let variant = translationBranch.best();
        if (!variant) {
            jsenv.warn('no match for translation', translationName);
            return translationName;
        }

        return variant.compile().render();
    }
});

const Translation = I18N.defineChild('Translation', {
    constructor(name) {
        Translation.super.constructor.call(this);
        this.name = name;
    },

    populate(data, origin) {
        if (typeof data === 'string') {
            this.register(...arguments);
        } else if (typeof data === 'object') {
            Object.keys(data).forEach(function(key) {
                let value = data[key];
                let variantOrigin;

                if (origin) {
                    variantOrigin = origin + '+' + key;
                } else {
                    variantOrigin = key;
                }

                this.populate(value, variantOrigin);
            }, this);
        }
    },

    match() {
        return this.children.filter(function(variant) {
            return variant.match();
        }, this);
    },

    best() {
        let match = this.match();
        let bestMatch;

        if (match.length > 0) {
            // sort variants by option.variantCompare
            let compare = this.options.createVariantCompare();

            bestMatch = match.sort(compare)[0];
        } else {
            bestMatch = null;
        }

        return bestMatch;
    },

    exec(value) {
        return this.branch({
            scope: value
        });
    },

    render(value) {
        return this.exec(value).render();
    }
});

const TranslationVariant = Translation.defineChild('TranslationVariant', {
    template: undefined,
    lang: undefined,

    constructor(string) {
        TranslationVariant.super.constructor.call(this);

        let template = TranslationTemplate.create();
        template.parse(string);
        this.template = template;
    },

    populate(data) {
        // console.log('variant populate called with', data);

        data.split('+').filter(function(string) {
            return string.length > 0;
        }).forEach(function(string) {
            let stringParts = this.childPrototype.parse(string);
            let traitName = stringParts.name;

            if ((traitName in this.options.traits) === false) {
                throw new Error('no such trait :' + traitName);
            }

            let traitPrototype = this.options.traits[traitName];
            let trait = traitPrototype.create(stringParts.params);
            trait.negated = stringParts.negated;

            this.add(trait);
        }, this);
    },

    getPreferenceLevel() {
        return this.children.reduce(function(previous, trait) {
            previous += trait.getPreferenceLevel();
            return previous;
        }, -1);
    },

    getLevel() {
        return this.children.length;
    },

    match() {
        // console.log('does', this.trait.traits[0], 'match', compileOptions.preferences);
        // console.log(this.trait.traits[0].match(compileOptions));
        return this.children.every(function(trait) {
            return trait.match();
        });
    },

    compile() {
        return this.template.compile(this.options);
    }
});

const I18NTrait = TranslationVariant.defineChild('I18NTrait', {
    chars: {
        negate: '!',
        paramsPrefix: ':',
        paramsSeparator: ','
    },
    negated: false,
    params: [],

    constructor(params) {
        if (params) {
            this.params = this.params.slice();
            this.params.push(...params);
        }
    },

    getPreferenceLevel() {
        return -1;
    },

    match() {
        return this.check(...this.params) !== this.negated;
    },

    toString() {
        let string = this.name;
        if (this.negated) {
            string = this.chars.negate + string;
        }
        if (this.params.length > 0) {
            string += this.chars.paramsPrefix + this.params.join(this.chars.paramsSeparator);
        }

        return string;
    },

    parse(string) {
        let transformerData = Transformer.parse(string);
        let name = transformerData.name;
        let traitName;
        let traitNegated;

        if (name[0] === this.chars.negate) {
            traitNegated = true;
            traitName = name.slice(1);
        } else {
            traitNegated = false;
            traitName = name;
        }

        let traitData = Object.assign(transformerData, {
            name: traitName,
            negated: traitNegated
        });

        // console.log('trait', string, 'parsed to', traitData);

        return traitData;
    }
});

[
    function registerTransformer(data) {
        let CustomTransformer;

        if (typeof data === 'function') {
            CustomTransformer = I18NTransformer.extend({
                name: data.name,
                check: data
            });
        } else if (typeof data === 'string') {
            let parts = Transformer.parse(arguments[1]);
            let TransformerModel = Options.ensure(this.options.transformers, parts.name);

            CustomTransformer = TransformerModel.extend({
                name: data,
                params: parts.params
            });
        }

        this.options.transformers[CustomTransformer.name] = CustomTransformer;
    },
    function registerTrait() {
        let CustomTrait;

        if (arguments.length === 1) {
            let traitData = arguments[0];

            if (typeof traitData === 'function') {
                CustomTrait = I18NTrait.extend({
                    name: traitData.name,
                    check: traitData
                });
            }
        }

        this.options.traits[CustomTrait.name] = CustomTrait;
    }
].forEach(function(method) {
    I18N[method.name] = method;
    Translation[method.name] = method;
});

const LanguageTrait = I18NTrait.extend('LanguageTrait', {
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

// lang:en, lang:fr, lang:en-us
I18N.options.traits.lang = LanguageTrait;

I18N.Trait = I18NTrait;
I18N.LanguageTrait = LanguageTrait;

export default I18N;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("core", function() {
            let i18n = I18N.create();
            let translation = i18n.register("greetings");

            let enVariant = translation.register("Hello");
            enVariant.add(LanguageTrait.equals("en"));

            let frVariant = translation.register("Bonjour");
            frVariant.add(LanguageTrait.equals("fr"));

            let enTranslationBranch = translation.branch({
                preferences: ['en']
            });

            let frTranslationBranch = translation.branch({
                preferences: ['fr']
            });

            assert.equal(
                enTranslationBranch.best().compile().render(), 'Hello'
            );

            assert.equal(
                frTranslationBranch.best().compile().render(), 'Bonjour'
            );
        });

        this.add("trait.getPreferenceLevel()", function() {
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

        this.add("variant.populate()", function() {
            let variant = TranslationVariant.create('ok');
            variant.populate("lang:fr+lang:en");

            assert.equal(variant.children[0].params[0], 'fr');
            assert.equal(variant.children[1].params[0], 'en');
        });

        this.add("translation.populate()", function() {
            let translation = Translation.create("greetings");
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

        this.add("i18n.populate()", function() {
            let i18n = I18N.create();
            i18n.populate({
                greetings: 'Hello',
                test: {
                    "lang:fr": 'ok'
                }
            });

            assert.equal(i18n.children[0].name, 'greetings');
            assert.equal(i18n.children[1].name, 'test');
        });

        this.add("create() will auto populate when passing extra arguments", function() {
            let i18n = I18N.create({
                greetings: 'hello'
            });

            assert.equal(i18n.children[0].name, 'greetings');
        });
    }
};

/*
const ValidationMessage = proto.extend('ValidationMessage', {
    languageName: undefined,
    languages: {},

    constructor() {

    },

    getLanguage() {
        let name = this.languageName;

        if (!name) {
            let availableLanguages = Object.keys(this.languages);

            if (availableLanguages.length === 0) {
                throw new Error('there is no available language');
            }

            name = availableLanguages[0];
            this.languageName = name;
        }

        if ((name in this.languages) === false) {
            throw new Error(name + ' language is not supported');
        }

        let language = this.languages[name];

        return language;
    },

    getTags(language) {
        let tags;

        if ('tags' in language) {
            tags = language.tags;
        } else {
            tags = {};
        }

        return tags;
    },

    getKeywordBestLanguageKey(keyword, language) {

    },

    getters: {
        name(keyword) {
            return keyword.valueName;
        },
        propertyWord( keyword ) {
            return 'property';
        },
        propertyName(keyword) {
            return keyword.propertyName;
        },
        expected(keyword) {
            return keyword.value;
        },
        keyword(keyword) {
            return keyword.name;
        }
    },

    createDefinitionMessage(keyword) {
        const language = this.getLanguage();
        const languageKey = this.getKeywordBestLanguageKey(keyword, language);
        const languageTemplate = language.keys[languageKey];

        let string;
        // if it's an abstraction ignore the keyword and get message of the abstracted keyword? I suppose yeah
        if (InstructionList.isPrototypeOf(keyword)) {
            string = createStringFromTemplate(languageTemplate, function(name) {
                return keyword.keywords.filter(function(subKeyword) {
                    return subKeyword.filter();
                }).map(function(subKeyword) {
                    return this.createDefinitionMessage(subKeyword);
                }, this).join(' AND ');
            }, this, language.filters);
        } else {
            string = createStringFromTemplate(languageTemplate, function(name) {
                var value;

                if (name in this.getters) {
                    value = this.getters[name].call(this, keyword);
                } else if (keyword.params.has(name)) {
                    value = keyword.params.get(name);
                } else {
                    value = '{' + name + '}';
                }

                return value;
            }, this, language.filters);
        }

        return string;
    }

    getMessageFor(value){
        return this.checkValidity(value).createMessage();
    },

    check(value){
        var validity = this.checkValidity(value);

        if( !validity.valid ){
            throw new ValidationError(validity.createMessage());
        }

        return value;
    }
});

*/
