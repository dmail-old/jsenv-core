/*

à faire en dernier : filter ait accès à une sorte d'objet options shared par lui jusq'au Dictionnary
sachant qu'on peut faire des appels successif pour remplier un dictionnary
donc en gros il faut en méthode du genre concat() (append) qui permet de rajouter les entry d'un dictionnaire à un autre

registerFilter()
registerTrait()
append(dataToCompileOrDictionnary) -> doit émettre une erreur si l'entry existe déjà
tout ça sur dictionnary, et ça ne doit pas être partagé parmi les instances de Dictionnary

MORE:
- merge(dataToCompileOrDictionnary) -> ajoute les entry n'existant pas, merge les définitions pour celles qui existent
- replace(dataToCompileOrDictionnary) -> remplace les entry au lieu d'ajouter des entry/definition
- concat(dataToCompileOrDictionnary) -> return a new dictionnary which is the concatenation of this & the one in argument
on pourrais avori besoin de ça sur entries en fait on ferai
dict.filters.register(name, filterMethod)
dict.filters.registerAll()
dict.entries.register()
dict.entries.replaceAll()
dict.entries.concat()
le truc c'est que les filtres, on a pu le voir avec keyword peuvent être vraiment spécifiques à un dictionnaire en particulier
sauf aussi qu'on va changer de stratégie par rapport à ça
il n'y arua pas un dictionnaire des keyword mais un dictionnaire par keyword
du coup chaque keyword peut définir ses filtres sans risquer un conflict avec les autres
lorsque l'on souhaitera look() pour un keyword et bien il faudra avoir connaissance de tous les dictionnaires pour savoir dans lequel chercher
autrement dit un dictionnaire par object et non un dictionnaire par module
ça serais cependant cool d'avoir la possibilité de concat() des dictionnaires entre eux pour obtenir un gros dico
c'est pourquoi les filtres/transformers doivent vraiment appartenir à la définition et pas au dico pour qu'on puisse concat toutes les
définitions ensembles, il faut donc déjà allez au niveau des définitions pour voir comment on va faire ça
idéalement il faudrait aussi qu'on puisse avoir des filter/transformers qui soit globaux au dictionnaire/entry/definition

*/

import env from 'env';
import {CompilableNode} from 'env/string-template';

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
