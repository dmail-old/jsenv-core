/*

tag & filter are always executed from translationVariant because nothing else can trigger them
so passing as argument the caller is ok but caller is always a translationVariant object

*/

import jsenv from 'jsenv';
import proto from 'jsenv/proto';
import Options from 'jsenv/options';
import SortedArray from 'jsenv/array-sorted';

import TermTransformer from './term-transformer.js';
import TermTemplate from './term-template.js';

let options = Options.create(TermTemplate.options, {
    traits: Options.create(),
    transformers: Options.create(),

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

// application dictionnary owns every lexicon used in the application
const ApplicationDictionnary = proto.extend('ApplicationDictionnary', {
    options: options,
    parent: null,
    children: [],

    constructor() {
        this.options = Options.create(this.options);
        this.children = [];
    },

    create(...args) {
        let item = proto.create.apply(this, args);

        if (this.populate) {
            let constructorLength = this.constructor.length;
            // console.log(proto.kindOf(item), 'constructorLength', this.constructor.length);
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
        let branch = this.extend({
            options: Options.create(this.options, options)
        });

        if (this.childPrototype) {
            branch.childPrototype = this.childPrototype.branch(branch.options);
        }

        branch.children = this.children.map(function(child) {
            let branchChild = child.branch(branch.options);
            branchChild.parent = branch;
            return branchChild;
        }, this);

        return branch;
    },

    detachedBranch() {
        let branch = this.extend({
            options: Options.create(this.options, options)
        });

        branch.children = [];

        return branch;

        // should create a kind of clone of this and options, same for children
        // but we wouldn't have to clone everything or maube we do
        // because I got no use case atm and it may be complicated juste let it as it is
    }
});

// lexicon are a group of terms, each module will have its own lexicon
const Lexicon = ApplicationDictionnary.defineChild('Lexicon', {
    populate(data) {
        Object.keys(data).forEach(function(key) {
            this.register(key, data[key]);
        }, this);
    },

    get(translationName) {
        let translation = this.get(translationName);

        if (!translation) {
            // a warning saying nothing has matched
            jsenv.warn('no translation named', translationName);
        }

        return translation;
    },

    translate(translationName, scope = undefined) {
        let translation = this.get(translationName);
        return translation ? translation.render(scope) : translationName;
    }
});

// a term is identified by his name, by it self it does nothing
const Term = Lexicon.defineChild('Term', {
    constructor(name) {
        Term.super.constructor.call(this);
        this.name = name;
    },

    populate(data, origin) {
        if (typeof data === 'string') {
            this.register(...arguments);
        } else if (typeof data === 'object') {
            Object.keys(data).forEach(function(key) {
                let value = data[key];

                if (key === 'transformers') {
                    Object.keys(value).forEach(function(transformerName) {
                        this.registerTransformer(transformerName, value[transformerName]);
                    }, this);
                } else if (key === 'traits') {
                    Object.keys(value).forEach(function(traitName) {
                        this.registerTrait(traitName, value[traitName]);
                    }, this);
                } else {
                    let variantOrigin;

                    if (origin) {
                        variantOrigin = origin + '+' + key;
                    } else {
                        variantOrigin = key;
                    }
                    this.populate(value, variantOrigin);
                }
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

    render(scope) {
        let termBranch = this.exec(scope);

        let variant = termBranch.best();
        if (!variant) {
            jsenv.warn('no match for translation', this.name);
            return this.name;
        }

        return variant.render();
    }
});

// a variant is a way to represent a term. every term has a best variant, which is computed from a variant traits
const Variant = Term.defineChild('Variant', {
    template: undefined,
    lang: undefined,

    constructor(string) {
        Variant.super.constructor.call(this);

        let template = TermTemplate.create();
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
    },

    render() {
        return this.compile().render();
    }
});

// a variant trait is used to know if a variant is the best one for a given term
const VariantTrait = Variant.defineChild('VariantTrait', {
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

    populate: null,

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
        let transformerData = TermTransformer.parse(string);
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
    function registerTransformer() {
        if (arguments.length !== 2) {
            throw new Error('registerTransformer expect two arguments');
        }

        let firstArg = arguments[0];
        if (typeof firstArg !== 'string') {
            throw new TypeError('registerTransformer first argument must be a string');
        }
        let secondArg = arguments[1];
        let CustomTransformer;
        if (typeof secondArg === 'function') {
            CustomTransformer = TermTransformer.extend({
                name: firstArg,
                check: secondArg
            });
        } else if (typeof secondArg === 'string') {
            let parts = TermTransformer.parse(secondArg);
            let TransformerModel = Options.ensure(this.options.transformers, parts.name);

            CustomTransformer = TransformerModel.extend({
                name: firstArg,
                params: parts.params
            });
        } else {
            throw new TypeError('registerTransformer second argument must be a function or a string');
        }

        this.options.transformers[CustomTransformer.name] = CustomTransformer;
    },

    function registerTrait() {
        if (arguments.length !== 2) {
            throw new Error('registerTrait expect two arguments');
        }

        let firstArg = arguments[0];
        if (typeof firstArg !== 'string') {
            throw new TypeError('registerTrait first argument must be a string');
        }
        let secondArg = arguments[1];
        let CustomTrait;
        if (typeof secondArg === 'function') {
            CustomTrait = VariantTrait.extend({
                name: firstArg,
                check: secondArg
            });
        } else if (typeof secondArg === 'string') {
            let parts = TermTransformer.parse(secondArg);
            let TraitModel = Options.ensure(this.options.traits, parts.name);

            CustomTrait = TraitModel.extend({
                name: firstArg,
                params: parts.params
            });
        } else {
            throw new TypeError('registerTrait second argument must be a function or a string');
        }

        this.options.traits[CustomTrait.name] = CustomTrait;
    }
].forEach(function(method) {
    ApplicationDictionnary[method.name] = method;
    Lexicon[method.name] = method;
    Term[method.name] = method;
});

ApplicationDictionnary.Lexicon = Lexicon;
ApplicationDictionnary.Term = Term;
ApplicationDictionnary.Variant = Variant;
ApplicationDictionnary.Trait = VariantTrait;

export default ApplicationDictionnary;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("i18n.populate()", function() {
            let branch = ApplicationDictionnary.Lexicon.branch();
            let lexicon = branch.create();

            lexicon.populate({
                greetings: 'Hello',
                test: 'ok'
            });

            assert.equal(lexicon.children[0].name, 'greetings');
            assert.equal(lexicon.children[1].name, 'test');
        });

        this.add("create() will auto populate when passing extra arguments", function() {
            let branch = ApplicationDictionnary.Lexicon.branch();
            let lexicon = branch.create({
                greetings: 'hello'
            });

            assert.equal(lexicon.children[0].name, 'greetings');
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
