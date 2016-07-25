/*

à faire en dernier : filter ait accès à une sorte d'objet options shared par lui jusq'au Dictionnary
qu'on puisse compiler un dictionnary, un dictionnary entry depuis un object du genre
{ // dictionnary
    "greetings": { // dictionnary entry
        "fr"// context: "Bonjour", // definition
        "en": "Hello"
    }
}
sachant qu'on peut faire des appels successif pour remplier un dictionnary
donc en gros il faut en méthode du genre concat() qui permet de rajouter les entry d'un dictionnaire à un autre

*/

// import env from 'env';

// import Options from 'env/options';
// import SortedArray from 'env/array-sorted';

import env from 'env';
// import proto from 'env/proto';
import {
    CompilableNode
} from 'env/string-template';

import Entry from './entry.js';

const Dictionnary = CompilableNode.extend({
    name: 'dictionnary',
    childPrototype: Entry,
    childrenPropertyName: 'entries',

    get: function(entryName) {
        let entry = this.entries.find(function(entry) {
            return entry.name === entryName;
        });

        if (!entry) {
            // a warning saying nothing has matched
            env.warn('no entry named', entryName);
        }

        return entry;
    },

    look(entryName, input = undefined) {
        let entry = this.get(entryName);

        if (entry) {
            return entry.eval(input);
        }

        return entryName;
    }
});
Dictionnary.registerCompiler({
    compile(syntaxNode) {
        var value = syntaxNode.value;

        if (typeof value === 'object') {
            Object.keys(value).forEach(function(key) {
                let entrySyntaxNode = syntaxNode.next();

                entrySyntaxNode.value = {
                    [key]: value[key]
                };
            });

            syntaxNode.value = '';
            return syntaxNode;
        }
    }
});

export default Dictionnary;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('compile object', function() {
            var dictionnary = Dictionnary.compile({
                greetings: {
                    filter: 'bonjour',
                    '': 'hello'
                },
                warning: 'warning'
            });

            assert(dictionnary.entries[0].name === 'greetings');
            assert(dictionnary.entries[0].definitions[0].context.toString() === 'filter');
            assert(dictionnary.entries[1].name === 'warning');
            assert(dictionnary.look('greetings') === 'bonjour'); // because it does have matching filter
        });
    }
};

/*
let options = Options.create(TermTemplate.options, {
    traits: {},
    transformers: {},

    createDefinitionComparer() {
        return SortedArray.createComparer(
            // si y'a des langues, compare le niveau de préférences des langues, le plus haut gagne
            function(definition) {
                return definition.getPreferenceLevel();
            },
            // sinon c'est la variantes ayant le plus de trait qui prévaut
            function(definition) {
                return definition.getLevel();
            }
        ).compare;
    },

    instantiateTransformer(transformerData) {
        let transformerName = transformerData.name;
        let transformer = Options.ensure(this.transformers, transformerName);
        return transformer.create(transformerData.params);
    }
});

let branchableProperties = {
    options: options,

    branch(parent) {
        let branch = this.extend({
            constructor: this.constructor, // for the constructor.length check
            // inherit from parent options, else inherit from self options
            options: parent ? Options.create(parent.options, this.options) : Options.create(this.options)
        });

        if (this.hasOwnProperty('childPrototype')) {
            let childPrototype = this.childPrototype;
            let childPrototypeBranch = childPrototype.branch(branch);
            branch.childPrototype = childPrototypeBranch;
            // console.log('update', proto.kindOf(this.childPrototype), 'on', proto.kindOf(branch));
            branch[proto.kindOf(childPrototypeBranch)] = childPrototypeBranch;
        }

        if (this.hasOwnProperty('children')) {
            branch.children = this.children.map(function(child) {
                let branchChild = child.branch(branch);
                branchChild.parent = branch;
                return branchChild;
            }, this);
        }

        return branch;
    },

    detachedBranch() {
        // the idea is to remove the protoype link between this object and the returned branch
        // so we don't use extend here, we want the same object that cannot impact or be impacted by this
        // in short it's a clone
        // the interest is that the cloned object is not linked to parents anymore
        // because this is not useful anywhere for now this function is not implemented
    }
};

let parentProperties = Object.assign(branchableProperties, {
    // childPrototype: null,
    children: [],

    create(...args) {
        let item = proto.create.apply(this, args);

        item.children = [];
        item.options = Options.create(this.options);
        // console.log('just created a', proto.kindOf(item), 'will populate with', args.slice(this.constructor.length), 'test' in item.options);

        return item;
    },

    defineChild(childPrototype) {
        if (this.hasOwnProperty('childPrototype')) {
            throw new Error('childPrototype already defined');
        }

        this.childPrototype = childPrototype;
        childPrototype.options = Options.create(this.options);
        this[proto.kindOf(childPrototype)] = childPrototype;

        return childPrototype;
    },

    registerChild() {
        let childPrototype = proto.extend.apply(this, arguments);

        return this.defineChild(childPrototype);
    },

    has(childName) {
        return Boolean(this.get(childName));
    },

    get: function(childName, ensure = false) {
        let foundChild = this.children.find(function(child) {
            return child.name === childName;
        });

        if (ensure && !foundChild) {
            throw new Error('no such child: ' + childName);
        }

        return foundChild;
    },

    add(child) {
        child.options = Options.create(this.options, child.options);
        child.parent = this;
        this.children.push(child);
        return child;
    },

    createChild(...args) {
        let child = this.childPrototype.create(...args);

        return child;
    },

    // one day I'll need updateAll(data)
    // and replaceAll(data)
    // insertAll(data) c'est le populate actuel
    // populate doit devenir une propriété de l'object lui-même, le populateParent à réfléchir
    // faudra clean tout ça

    populate(...args) {
        let childPrototype = this.childPrototype;
        if (childPrototype && childPrototype.populateParent) {
            // console.log('call', proto.kindOf(child), 'populate with', args.slice(constructorLength), 'from', args);
            childPrototype.populateParent(this, ...args);
        }
    },

    register(...args) {
        let child = this.createChild(...args);

        this.add(child);

        let constructorLength = child.constructor.length;
        if (args.length > constructorLength) {
            // console.log(proto.kindOf(child), 'constructorLength', child.constructor.length, 'test' in this.options.traits, 'test' in child.options.traits);
            child.populate(...args.slice(constructorLength));
        }

        return child;
    }
});

// a dictionnary is language agnostic by default, it will contains terms. You'll typically create a dictionnary per module
const Dictionnary = proto.extend('Dictionnary', parentProperties, {
    get: function(translationName) {
        let translation = this.get(translationName); // this.get would loop forever here

        if (!translation) {
            // a warning saying nothing has matched
            env.warn('no translation named', translationName);
        }

        return translation;
    },

    translate(translationName, scope = undefined) {
        let translation = this.get(translationName);
        return translation ? translation.render(scope) : translationName;
    }
});

// a term is a dictionnary entry, it's identified by a string (should we rename it Entry?)
const Term = Dictionnary.registerChild('Term', parentProperties, {
    constructor(name) {
        this.name = name;
    },

    populateParent(parent, data) {
        return Object.keys(data).forEach(function(key) {
            parent.register(key, data[key]);
        }, this);
    },

    match() {
        return this.children.filter(function(definition) {
            return definition.match();
        }, this);
    },

    best() {
        let bestMatch = this.children.sort(this.options.createDefinitionComparer()).find(function(definition) {
            return definition.match();
        });

        return bestMatch;
    },

    eval(value) {
        let branch = this.branch();

        branch.options.scope = value;

        return branch;
    },

    render(scope) {
        let evaluatedTerm = this.eval(scope);

        let bestDefinition = evaluatedTerm.best();
        if (!bestDefinition) {
            env.warn('no definition for term', this.name);
            return this.name;
        }

        return bestDefinition.render();
    }
});

// a term may have 0 to n definition
const TermDefinition = Term.registerChild('Definition', parentProperties, {
    template: undefined,

    constructor(string) {
        let template = TermTemplate.create();
        template.parse(string);
        this.template = template;
    },

    populateParent(parent, data, prefix) {
        if (typeof data === 'string') {
            // console.log('registering', arguments);
            parent.register(...Array.prototype.slice.call(arguments, 1));
        } else if (typeof data === 'object') {
            Object.keys(data).forEach(function(key) {
                let value = data[key];

                if (key === 'transformers') {
                    Object.keys(value).forEach(function(transformerName) {
                        parent.registerTransformer(transformerName, value[transformerName]);
                    }, this);
                } else if (key === 'traits') {
                    Object.keys(value).forEach(function(traitName) {
                        parent.registerTrait(traitName, value[traitName]);
                    }, this);
                } else {
                    let traitName;

                    if (prefix) {
                        traitName = prefix + '+' + key;
                    } else {
                        traitName = key;
                    }
                    parent.populate(value, traitName);
                }
            }, this);
        }
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

// a term definition can have 0 to n trait used to express definition circumstances
const TermDefinitionTrait = TermDefinition.registerChild('Trait', {
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
    },

    populateParent(parent, data) {
        // console.log('definition populate called with', data, data in this.options.traits);

        data.split('+').filter(function(string) {
            return string.length > 0;
        }).forEach(function(string) {
            let stringParts = this.parse(string);
            let traitName = stringParts.name;

            if (Options.has(parent.options.traits, traitName) === false) {
                throw new Error('no such trait: ' + traitName);
            }

            let traitPrototype = parent.options.traits[traitName];
            let trait = traitPrototype.create(stringParts.params);
            trait.negated = stringParts.negated;

            parent.add(trait);
        }, this);
    },

    getPreferenceLevel() {
        return -1;
    },

    check() {
        return true;
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
            CustomTrait = TermDefinitionTrait.extend({
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
    Dictionnary[method.name] = method;
    Term[method.name] = method;
});
*/

// export default Dictionnary;

// export const test = {
//     modules: ['@node/assert'],

//     main(assert) {
//         this.add("register() created a child, register it", function() {
//             let dict = Dictionnary.create();
//             let term = dict.register("greetings");

//             assert.equal(Object.getPrototypeOf(term), Term);
//             assert.equal(dict.children[0], term);
//             assert.equal(Object.getPrototypeOf(term.options), dict.options);
//         });

//         this.add("populate() create child objects", function() {
//             let dict = Dictionnary.create();

//             dict.populate({
//                 greetings: 'Hello',
//                 test: 'ok'
//             });

//             assert.equal(dict.children[0].name, 'greetings');
//             assert.equal(dict.children[1].name, 'test');
//         });

//         this.add("create() auto populate when passing extra arguments", function() {
//             let dict = Dictionnary.create({
//                 greetings: 'hello'
//             });

//             assert.equal(dict.children[0].name, 'greetings');
//         }).skip('impossible because created tearm does not have access yet to dict options because not added');

//         this.add("branch() keep the branch linked by prototype", function() {
//             let dictBranch = Dictionnary.branch();

//             assert.equal(Object.getPrototypeOf(dictBranch), Dictionnary);
//             assert.equal(Object.getPrototypeOf(dictBranch.options), Dictionnary.options);
//             assert.equal(Object.getPrototypeOf(dictBranch.Term), Dictionnary.Term);
//             assert.equal(Object.getPrototypeOf(dictBranch.Term.options), dictBranch.options);
//             assert.equal(Object.getPrototypeOf(dictBranch.Term.Definition), Dictionnary.Term.Definition);

//             let term = dictBranch.register('yo');
//             assert.equal(Object.getPrototypeOf(term.options), dictBranch.options);
//             term.register('test');
//             let termBranch = term.branch();
//             assert.equal(Object.getPrototypeOf(termBranch.children[0].options), termBranch.options);
//         });

//         this.add("trait", function() {
//             let branch = Dictionnary.branch();

//             branch.options.traits.test = TermDefinitionTrait.extend();

//             let term = branch.register('test');
//             assert.equal('test' in term.options.traits, true);

//             let definitionA = term.register('definitionA');
//             assert.equal('test' in definitionA.options.traits, true);
//             let definitionB = term.register('definitionB', 'test');
//             assert.equal('test' in definitionB.options.traits, true);
//         });
//     }
// };

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
